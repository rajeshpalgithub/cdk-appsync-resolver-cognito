const AWS = require("aws-sdk");
const mysql = require('mysql');
const secretsManager = new AWS.SecretsManager();

async function rdsAllProducts(){
    let sm = await secretsManager.getSecretValue({ SecretId: process.env.RDS_SEC}).promise();
    let credentials = JSON.parse(sm.SecretString);

    //return credentials.username;
  
    var connection = mysql.createConnection({
        host     : process.env.RDS_ENDPOINT,
        user     : credentials.username,
        password : credentials.password,
        database : process.env.RDS_DB,
        port     : '3306'
      });
      
      try{
        connection.query('show tables', function (error:any, results:any) {
          if (error) {
              console.log('error connecting table');
              return 'DB Connection error';
          } else {
              // connected!
              console.log('Result',results);
              
              connection.end();

              return 'DB Connection Success';
          }
        });
      }catch(err)
      {
        
        console.log(err);
        return 'Catch error';
      }
      return credentials.username;
}

export default rdsAllProducts;