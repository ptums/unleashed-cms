import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as s3 from "aws-cdk-lib/aws-s3";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as iam from "aws-cdk-lib/aws-iam";
import { CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as logs from "aws-cdk-lib/aws-logs";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

// The ACM certificate for cms.uptherapygroup.com. CloudFront needs it in us-east-1.
// Only the certificate ID is here. The account ID comes from the deploy (this.account),
// so it never goes in this public repo.
const ADMIN_CERT_ID = "13df873a-f9ee-4812-bd9f-3a0f480fb213";

export class UnleashedCmsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Admin Cert
    const adminCert = acm.Certificate.fromCertificateArn(
      this,
      "AdminCert",
      `arn:aws:acm:us-east-1:${this.account}:certificate/${ADMIN_CERT_ID}`,
    );

    // MEDIA: images the editor uploads. Key: uploads/<uuid>.<ext>
    const mediaBucket = new s3.Bucket(this, "MediaBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: [
            "http://localhost:5173",
            "https://cms.uptherapygroup.com",
          ],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
    });

    const adminBucket = new s3.Bucket(this, "AdminBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const adminSite = new cloudfront.Distribution(this, "AdminSite", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      // Public read of uploaded images for the site: https://cms.uptherapygroup.com/uploads/<uuid>.<ext>
      // The bucket stays private. Only CloudFront reads it (origin access control), and only GET.
      // Upload keys are random uuids, so a file is reachable only when content links to it.
      additionalBehaviors: {
        "/uploads/*": {
          origin: origins.S3BucketOrigin.withOriginAccessControl(mediaBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      certificate: adminCert,
      domainNames: ["cms.uptherapygroup.com"],
    });

    new s3deploy.BucketDeployment(this, "AdminFiles", {
      sources: [s3deploy.Source.asset("admin/dist")], // the output of npm run build
      destinationBucket: adminBucket,
      distribution: adminSite,
      distributionPaths: ["/*"], // drop all old copies in CloudFront
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
    const api = new apigwv2.HttpApi(this, "CmsApi", {
      corsPreflight: {
        allowOrigins: [
          "http://localhost:5173",
          "https://cms.uptherapygroup.com",
        ],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.DELETE,
        ],
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    // Rate Limiting
    // 1 admin page load sends about 7 calls at the same time, and each call also sends a
    // CORS preflight (OPTIONS). So 1 load is about 14 requests. A burst of 10 gave 429s.
    // These limits still stop a runaway loop, and the $10 budget alert is the cost guard.
    const stage = api.defaultStage!.node.defaultChild as apigwv2.CfnStage;
    stage.defaultRouteSettings = {
      throttlingBurstLimit: 50,
      throttlingRateLimit: 10,
    };

    api.addRoutes({
      path: "/pages/{id}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetPageIntegration", getPageFn),
    });

    // The public read of 1 published collection entry. Same Lambda as /pages/{id} (see content-key.ts).
    api.addRoutes({
      path: "/collections/{type}/entries/{slug}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("GetEntryIntegration", getPageFn),
    });

    // The public list of published slugs in 1 collection (see list-published.ts).
    const listPublishedFn = new NodejsFunction(this, "ListPublishedFn", {
      entry: "lambda/list-published.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadData(listPublishedFn);

    api.addRoutes({
      path: "/collections/{type}/entries",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListPublishedIntegration", listPublishedFn),
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

    // THE OTHER ADMIN ROUTES (Claude). Each one copies the GET /admin/pages pattern:
    // 1 Lambda, the grants it needs, and its routes with the Clerk authorizer.
    // A page ({id}) and a collection entry ({type}/{slug}) share 1 Lambda (see content-key.ts).
    const PAGE = "/admin/pages/{id}";
    const ENTRY = "/admin/collections/{type}/entries/{slug}";

    const env = {
      TABLE_NAME: table.tableName,
      SCHEMA_TABLE_NAME: schemaTable.tableName,
      MEDIA_BUCKET_NAME: mediaBucket.bucketName,
    };

    // Makes 1 admin Lambda and adds its routes, all behind the Clerk authorizer.
    const adminRoute = (
      id: string,
      entry: string,
      method: apigwv2.HttpMethod,
      paths: string[],
      options: { timeout?: cdk.Duration; memorySize?: number } = {},
    ) => {
      const fn = new NodejsFunction(this, id, {
        entry,
        runtime: lambda.Runtime.NODEJS_22_X,
        environment: env,
        ...options,
      });
      for (const path of paths) {
        api.addRoutes({
          path,
          methods: [method],
          integration: new HttpLambdaIntegration(`${id}Integration`, fn),
          authorizer: clerkAuthorizer,
        });
      }
      return fn;
    };

    const getDraftFn = adminRoute(
      "GetDraftFn",
      "lambda/get-draft.ts",
      apigwv2.HttpMethod.GET,
      [PAGE, ENTRY],
    );
    table.grantReadData(getDraftFn);

    const putDraftFn = adminRoute(
      "PutDraftFn",
      "lambda/put-pages.ts",
      apigwv2.HttpMethod.PUT,
      [PAGE, ENTRY],
    );
    table.grantWriteData(putDraftFn);

    const deleteFn = adminRoute(
      "DeleteFn",
      "lambda/delete-page.ts",
      apigwv2.HttpMethod.DELETE,
      [PAGE, ENTRY],
    );
    table.grantWriteData(deleteFn);

    // Publish runs the AI steps, so it needs more time than the 3 s default (a first publish took 3.3 s).
    const publishFn = adminRoute(
      "PublishFn",
      "lambda/publish-page.ts",
      apigwv2.HttpMethod.POST,
      [`${PAGE}/publish`, `${ENTRY}/publish`],
      { timeout: cdk.Duration.seconds(60), memorySize: 512 },
    );
    table.grantReadWriteData(publishFn);
    mediaBucket.grantRead(publishFn); // alt text reads each image
    publishFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"], // the Converse API uses this action
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        ],
      }),
    );

    const getSchemaFn = adminRoute(
      "GetSchemaFn",
      "lambda/get-schema.ts",
      apigwv2.HttpMethod.GET,
      ["/admin/schemas/{id}"],
    );
    schemaTable.grantReadData(getSchemaFn);

    const listCollectionsFn = adminRoute(
      "ListCollectionsFn",
      "lambda/list-collections.ts",
      apigwv2.HttpMethod.GET,
      ["/admin/collections"],
    );
    schemaTable.grantReadData(listCollectionsFn);

    const listEntriesFn = adminRoute(
      "ListEntriesFn",
      "lambda/list-entries.ts",
      apigwv2.HttpMethod.GET,
      ["/admin/collections/{type}/entries"],
    );
    table.grantReadData(listEntriesFn);

    const createEntryFn = adminRoute(
      "CreateEntryFn",
      "lambda/create-entry.ts",
      apigwv2.HttpMethod.POST,
      ["/admin/collections/{type}/entries"],
    );
    schemaTable.grantReadData(createEntryFn);
    table.grantWriteData(createEntryFn);

    const createUploadFn = adminRoute(
      "CreateUploadFn",
      "lambda/create-upload.ts",
      apigwv2.HttpMethod.POST,
      ["/admin/uploads"],
    );
    mediaBucket.grantPut(createUploadFn);

    const viewUploadFn = adminRoute(
      "ViewUploadFn",
      "lambda/view-upload.ts",
      apigwv2.HttpMethod.GET,
      ["/admin/uploads/{file}"],
    );
    mediaBucket.grantRead(viewUploadFn);

    // ---- Website form submissions: the debug log (ported from jessrebelo.com) ----
    // The site (Cloudflare Worker, /api/submit) writes 1 item per submission: metadata only,
    // never names, contact details or text. Each new item sends an anonymous alert by email.

    // Fixed capacity is the cost cap: extra traffic is throttled, not billed (no autoscaling).
    // The classic Table construct, because TableV2 requires autoscaling for write capacity.
    const submissionsTable = new dynamodb.Table(this, "FormSubmissionsTable", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      timeToLiveAttribute: "expiresAt", // 12 months, set by the site
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const submissionAlerts = new sns.Topic(this, "FormSubmissionAlerts", {
      displayName: "Website form submissions",
    });
    // AWS emails a confirmation link first. The alerts start after it is clicked.
    submissionAlerts.addSubscription(new subscriptions.EmailSubscription("tumultywebservices@gmail.com"));

    const notifyFn = new NodejsFunction(this, "NotifyNewSubmissionFn", {
      entry: "lambda/notify-new-submission.ts",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      environment: { TOPIC_ARN: submissionAlerts.topicArn },
      logGroup: new logs.LogGroup(this, "NotifyNewSubmissionLogs", {
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
    submissionAlerts.grantPublish(notifyFn);
    notifyFn.addEventSource(
      new DynamoEventSource(submissionsTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
        maxRecordAge: cdk.Duration.hours(1),
        bisectBatchOnError: true,
        // Only new submissions: no updates (the sent/failed mark) and no deletes (TTL).
        filters: [
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual("INSERT"),
            dynamodb: { Keys: { pk: { S: lambda.FilterRule.beginsWith("sub#") } } },
          }),
        ],
      }),
    );

    // The Worker's identity: write-only to this 1 table, no console access.
    // Peter makes its access key in the console and stores it as Worker secrets (never in CDK).
    const siteFormsUser = new iam.User(this, "SiteFormsUser");
    siteFormsUser.addToPolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem"],
        resources: [submissionsTable.tableArn],
      }),
    );

    new cdk.CfnOutput(this, "FormSubmissionsTableName", { value: submissionsTable.tableName });
    new cdk.CfnOutput(this, "SiteFormsUserName", { value: siteFormsUser.userName });

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "MediaBucketName", {
      value: mediaBucket.bucketName,
    });
    new cdk.CfnOutput(this, "AdminUrl", {
      value: `https://${adminSite.distributionDomainName}`,
    });
  }
}
