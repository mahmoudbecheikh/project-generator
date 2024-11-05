import fs from "fs-extra";
import path from "path";
import { showLoading } from "../db/myDB.js";
import { exec } from "child_process";
import { promisify } from "util";
import createProject from "../front/angular/createProject.js"

const execAsync = promisify(exec);

let projectKey;
export { projectKey };

export async function generateProject(req, res) {
  const { projectName, techFront, techBack, database, userId, dataConnect } =
    req.body;

  if (!projectName) {
    return res.status(400).send("Le nom du projet est requis.");
  }

  if (
    !dataConnect ||
    !dataConnect.database ||
    !dataConnect.host ||
    !dataConnect.port ||
    !dataConnect.username ||
    !dataConnect.password ||
    !dataConnect.namedb
  ) {
    return res
      .status(400)
      .send(
        "Les informations de connexion à la base de données sont incomplètes."
      );
  }

  const projectNameBack = projectName + "Back";
  const loadingInterval = showLoading();

  try {
    const projectKey = await generateKey(25);
    const projectsDir = path.join(process.cwd(), "projects", projectKey);

    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }

    switch (techFront) {
      case "Angular":
        await execAsync(`npx @angular/cli new ${projectName} --skip-install`, {
          cwd: projectsDir,
        });

        createProject(projectName, projectsDir)
        break;

      case "React":
        await copyProject(projectName, projectKey, "project-react");
        break;

      case "Vue":
        await copyProject(projectName, projectKey, "project-vue");
        break;

      default:
        clearInterval(loadingInterval);
        return res.status(400).send("Technologie front-end non supportée.");
    }

    switch (techBack) {
      case "Express":
        await copyProject(projectNameBack, projectKey, "project-express");
        switch (database) {
          case "mysql":
            generateMySQLConnectionContent(
              dataConnect,
              projectsDir,
              projectNameBack
            );
            break;
    
          case "mongoDB":
            generateMongooseConnectionContent(
              dataConnect,
              projectsDir,
              projectNameBack
            );
            break;
    
          case "postgres":
            generatePostgresConnectionContent(
              dataConnect,
              projectsDir,
              projectNameBack
            );
            break;
    
          default:
            clearInterval(loadingInterval);
            return res.status(400).send("Base de données non supportée.");
        }
        break;

      case "Nest":
        await copyProject(projectNameBack, projectKey, "project-nest");
        break;

      default:
        clearInterval(loadingInterval);
        return res.status(400).send("Technologie back-end non supportée.");
    }



    updatePackageJson(projectsDir, database, projectNameBack);

    clearInterval(loadingInterval);

    return res.json({
      success: true,
      message: "Projet créé avec succès.",
      projectKey,
    });
  } catch (error) {
    clearInterval(loadingInterval);
    console.error("Erreur lors de la génération du projet:", error);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la génération du projet.",
      details: error.message,
    });
  }
}

async function generateKey(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters.charAt(randomIndex);
  }
  return key;
}

async function copyProject(projectName, projectKey, projectTech) {
  const sourceDir = path.join(process.cwd(), `utils/${projectTech}`);

  try {
    const destPath = path.join(
      process.cwd(),
      "projects",
      projectKey,
      projectName
    );

    if (!fs.existsSync(destPath)) {
      await fs.mkdir(destPath, { recursive: true });
    }
    await fs.copy(sourceDir, destPath);
    //console.log(`Dossier copié avec succès de ${sourceDir} à ${destPath}`);
  } catch (error) {
    console.error("Erreur lors de la copie du dossier:", error);
  }
}

async function generateMySQLConnectionContent(
  dataConnect,
  projectDir,
  projectNameBack
) {
  const { host, port, username, password, namedb } = dataConnect;

  // Define the directory and file paths
  const projectBackDir = path.resolve(projectDir, projectNameBack, "db");
  const dbPath = path.join(projectBackDir, "dbConnection.js");

  // Create the directory if it doesn't exist
  await fs.mkdir(projectBackDir, { recursive: true });

  // Generate the connection content
  const content = `
var mysql = require('mysql2');
var connection = mysql.createConnection({
  host: '${host}',
  user: '${username}',
  password: '${password}',
  port: '${port}',
  database: '${namedb}'
});

connection.connect(function(error) {
  if (error) {
    console.log('Error Connecting: ', error);
  } else {
    console.log('Database Connected Successfully..!!');
  }
});



module.exports = connection;
`;

  // Write the file
  await fs.writeFile(dbPath, content, "utf8");
}

async function generateMongooseConnectionContent(
  dataConnect,
  projectDir,
  projectNameBack
) {
  const { host, port, username, password, namedb } = dataConnect;

  // Define paths for the backend project directory and files
  const projectBackDir = path.resolve(projectDir, projectNameBack, "db");
  const dbPath = path.join(projectBackDir, "dbConnection.js");
  const appFile = path.join(projectDir, projectNameBack, "app.js");

  // Read the content of the app.js file
  let contentApp;
  try {
    contentApp = await fs.readFile(appFile, "utf8");
  } catch (err) {
    console.error(`Failed to read ${appFile}:`, err);
    return;
  }

  // Ensure the db directory exists, create it if it doesn't
  try {
    await fs.mkdir(projectBackDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create directory ${projectBackDir}:`, err);
    return;
  }

  // Define the MongoDB connection content
  const content = `
const mongoose = require('mongoose');

mongoose.connect('mongodb://${username}:${password}@${host}:${port}/${namedb}', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});
module.exports = mongoose;

`;

  // Write the content to the dbConnection.js file
  try {
    await fs.writeFile(dbPath, content, "utf8");
    console.log(`Database connection file created at ${dbPath}`);
  } catch (err) {
    console.error(`Failed to write to ${dbPath}:`, err);
    return;
  }

  // Optionally, you can add the DB import line to app.js if it's not present
  const dbImportLine = `const db = require('./db/dbConnection');`;
  if (!contentApp.includes(dbImportLine)) {
    const updatedContentApp = `${dbImportLine}\n${contentApp}`;
    try {
      await fs.writeFile(appFile, updatedContentApp, "utf8");
      console.log(`Updated ${appFile} with the database connection import.`);
    } catch (err) {
      console.error(`Failed to update ${appFile}:`, err);
    }
  } else {
    console.log(`Database connection import already exists in ${appFile}.`);
  }
}

async function generatePostgresConnectionContent(
  dataConnect,
  projectDir,
  projectNameBack
) {
  const { host, port, username, password, namedb } = dataConnect;

  // Define the directory and file paths
  const projectBackDir = path.resolve(projectDir, projectNameBack, "db");
  const dbPath = path.join(projectBackDir, "dbConnection.js");

  // Create the directory if it doesn't exist
  await fs.mkdir(projectBackDir, { recursive: true });

  // Generate the connection content
  const content = `
const { Pool } = require('pg');
const pool = new Pool({
  user: '${username}',
  host: '${host}',
  database: '${namedb}',
  password: '${password}',
  port: ${port}
});

pool.on('connect', () => {
  console.log('Database Connected Successfully..!!');
});

pool.on('error', (err) => {
  console.error('Error Connecting: ', err);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    client.release(); 
  } catch (err) {
    console.error('Error testing the connection: ', err.message);
  }
};

testConnection();


module.exports = pool;
`;

  // Write the file
  await fs.writeFile(dbPath, content, "utf8");
}

async function updatePackageJson(projectDir, dbType, projectNameBack) {
  const packageJsonPath = path.join(
    projectDir,
    projectNameBack,
    "package.json"
  );

  try {
    const packageJsonData = await fs.readFile(packageJsonPath, "utf8");

    const packageJson = JSON.parse(packageJsonData);

    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    if (dbType === "mysql") {
      packageJson.dependencies["mysql2"] = "^3.11.0";
    } else if (dbType === "mongoDB") {
      packageJson.dependencies["mongoose"] = "^8.5.2";
    } else if (dbType === "postgres") {
      packageJson.dependencies["pg"] = "^8.12.0";
    } else {
      console.log("Unsupported database type.");
    }

    const updatedPackageJson = JSON.stringify(packageJson, null, 2);

    await fs.writeFile(packageJsonPath, updatedPackageJson, "utf8");

    //console.log(`${dbType} dependency added successfully!`);
  } catch (error) {
    console.error("Error updating package.json:", error);
  }
}
