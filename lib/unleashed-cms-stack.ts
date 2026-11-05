import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as s3 from "aws-cdk-lib/aws-s3";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

export class UnleashedCmsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // MEDIA: images the editor uploads. Key: uploads/<uuid>.<ext>
    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ["http://localhost:5173"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    // GET A PAGE
    const table = new dynamodb.TableV2(this, "ContentTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: "gsi1",
          partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
          sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SCHEMAS: pk = SCHEMA#<id>, sk = VERSION#<n> or LATEST.
    // No index: the page list comes from gsi1 on ContentTable.
    const schemaTable = new dynamodb.TableV2(this, "SchemaTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const getPageFn = new NodejsFunction(this, "GetPageFn", {
      entry: "lambda/get-pages.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grant(getPageFn, "dynamodb:GetItem");

    // AUTHORIZATION
    const clerkAuthorizer = new HttpJwtAuthorizer(
      "ClerkAuthorizer", // 1. an id
      "https://real-buffalo-6983.clerk.accounts.dev", // 2. who signs the tokens (the issuer)
      { jwtAudience: ["unleashed-cms"] }, // 3. options: the aud the token must have
    );

    const listPagesFn = new NodejsFunction(this, "ListPagesFn", {
      entry: "lambda/list-pages.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadData(listPagesFn);

    // GET ROUTE
    const api = new apigwv2.HttpApi(this, "CmsApi");

    // Rate Limiting
    const stage = api.defaultStage!.node.defaultChild as apigwv2.CfnStage;
    stage.defaultRouteSettings = {
      throttlingBurstLimit: 10,
      throttlingRateLimit: 2,
    };

    api.addRoutes({
      path: "/pages/{id}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetPageIntegration", getPageFn),
    });

    api.addRoutes({
      path: "/admin/pages",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "ListPagesIntegration",
        listPagesFn,
      ),
      authorizer: clerkAuthorizer,
    });

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "MediaBucketName", {
      value: mediaBucket.bucketName,
    });
  }
}
