import * as cdk from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as appsync from '@aws-cdk/aws-appsync';
import { GraphqlApi, Schema, FieldLogLevel, AuthorizationType } from '@aws-cdk/aws-appsync';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';
import * as ddb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as iam from '@aws-cdk/aws-iam';
import { Credentials, StorageType } from '@aws-cdk/aws-rds';
import { Duration } from '@aws-cdk/core';
import { InstanceClass, InstanceType, InstanceSize } from '@aws-cdk/aws-ec2';


export class UpworkTestStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //const credentail = Credentials.fromPassword('Admin',cdk.SecretValue.arguments);
    const RDS_DB_NAME = 'upworkTest';
    
    // VPC
    const vpc = new ec2.Vpc(this, 'upworkTestVpc')
    const mysql=new rds.DatabaseInstance(this, 'upworkTestRds', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_5_7
      }),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      publiclyAccessible: true,
      autoMinorVersionUpgrade: false,
      allocatedStorage: 25,
      storageType: StorageType.GP2,
      backupRetention: Duration.days(0),
      deletionProtection: false,
      instanceType:InstanceType.of(InstanceClass.BURSTABLE2, InstanceSize.MICRO),
      port: 3306,
      databaseName: RDS_DB_NAME
    });
    new cdk.CfnOutput(this, 'dbEndpoint', {
      value: mysql.instanceEndpoint.hostname,
    });

    new cdk.CfnOutput(this, 'secretName', {
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      value: mysql.secret?.secretName!,
    });




    // User Pool
    const userPool = new cognito.UserPool(this, 'cdk-upwork-test-user-pool', {
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      },
      
    })

    

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool
    })
    // Appsync GraphQL
    const api = new appsync.GraphqlApi(this, 'cdk-upwork-test', {
      name: "cdk-product-api",
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      schema: appsync.Schema.fromAsset('./graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool,
          }
        },
        additionalAuthorizationModes: [{
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365))
          }
        }]
      },
    });

    // Lambda

    const productLambda = new lambda.Function(this, 'AppSyncProductHandler', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'main.handler',
      code: lambda.Code.fromAsset('lambdaFunctions'),
      memorySize: 1024
    })
    const lambdaDs = api.addLambdaDataSource('lambdaDatasource', productLambda)
    
    // Lambda Resolver 
    
    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "getProductById"
    })
    
    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "listProducts"
    })
    
    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "createProduct"
    })
    
    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "deleteProduct"
    })
    
    lambdaDs.createResolver({
      typeName: "Mutation",
      fieldName: "updateProduct"
    })

    lambdaDs.createResolver({
      typeName: "Query",
      fieldName: "rdsListproduct"
    });

    

    ///////// DyanmoDB Tables
    const productTable = new ddb.Table(this, 'CDKProductTable', {
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'id',
        type: ddb.AttributeType.STRING,
      },
    })
    
    // Enable the Lambda function to access the DynamoDB table (using IAM)
    productTable.grantFullAccess(productLambda)
   
    
    // Create an environment variable that we will use in the function code
    productLambda.addEnvironment('PRODUCT_TABLE', productTable.tableName)

    
    const secrateReadPolicy = new iam.PolicyStatement({
      actions:['secretsmanager:GetSecretValue'],
      resources:[mysql.secret?.secretArn!]
    })
    productLambda.role?.attachInlinePolicy(
      new iam.Policy(this, 'read-secrate-policy',{
        statements:[secrateReadPolicy]
      })
    )
    const rdsPolicy = new iam.PolicyStatement({
      actions:['rds-db:connect'],
      resources:[mysql.instanceArn]
    })
    productLambda.role?.attachInlinePolicy(
      new iam.Policy(this, 'rds-policy',{
        statements:[rdsPolicy]
      })
    )
    productLambda.addEnvironment('RDS_ENDPOINT', mysql.instanceEndpoint.hostname)
    productLambda.addEnvironment('RDS_SEC', mysql.secret?.secretName!)
    productLambda.addEnvironment('RDS_DB', RDS_DB_NAME)

    
    
    

    ////// Client Configuration
    new cdk.CfnOutput(this, "GraphQLAPIURL", {
      value: api.graphqlUrl
    })
    
    new cdk.CfnOutput(this, 'AppSyncAPIKey', {
      value: api.apiKey || ''
    })
    
    new cdk.CfnOutput(this, 'ProjectRegion', {
      value: this.region
    })
    
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId
    })
    
    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId
    })

  }
}
