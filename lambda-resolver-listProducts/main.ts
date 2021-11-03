const AWS = require("aws-sdk");
var mysql = require('mysql');
const secretsManager = new AWS.SecretsManager();

exports.handler = async (event:any) => {
    let sm = await secretsManager.getSecretValue({ SecretId: process.env.RDS_SEC}).promise();
    let credentials = JSON.parse(sm.SecretString);
  
    var connection = mysql.createConnection({
        host     : process.env.RDS_ENDPOINT,
        user     : credentials.username,
        password : credentials.password,
        port     : '3306'
      });
      
      try{
          connection.connect(function(err:any) {
          if (err) {
            console.error('Database connection failed: ' + err.stack);
            return 'Database connection failed';
          }
          console.log('Connected to database.');
          return 'Connected to database.';
          
        });
  
        // connection.query('SELECT * FROM Product', function (error:any, results:any) {
        //   if (error) throw error;
        //   console.log('The solution is: ', results);
        // });
        
        connection.end();
      }catch(err)
      {
        return 'Catch error';
        console.log(err);
      }
      return 'nothing';
}