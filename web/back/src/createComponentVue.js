import path from "path";
import fs from "fs/promises";
import createCrud from "./back/node/createCrudNode.js";

export default async function createComponentVue(req, res) {
  const { projectName, selectedTables ,projectKey , database} = req.body;
  const projectNameBack = projectName+"Back";

  console.log(projectKey);
  if (!projectName) {
    return res.status(400).json({
      error: "You should select a project and connect to it before creating forms.",
    });
  }

  try {
    for (const selectedTable of selectedTables) {
      const componentName = capitalize(selectedTable.name);
      const projectDir = path.resolve("projects",projectKey ,projectName);
      const srcDir = path.join(projectDir, "src");
      const componentsDir = path.join(srcDir, "components");
      const servicesDir = path.join(srcDir, "services");

      await ensureDirectoryExists(projectDir);
      await fs.mkdir(componentsDir, { recursive: true });
      await fs.mkdir(servicesDir, { recursive: true });

      const serviceName = `${componentName}Service`;
      const componentPath = path.join(componentsDir, `${componentName}Component.vue`);
      const servicePath = path.join(servicesDir, `${serviceName}.js`);

      if (await fileExists(componentPath)) {
        return res.status(400).json({ error: `Component ${componentName} already exists.` });
      }

      await fs.writeFile(
        componentPath,
        generateComponentContent(componentName, selectedTable.fields),
        "utf8"
      );
      await fs.writeFile(
        servicePath,
        generateServiceContent(serviceName, selectedTable.name),
        "utf8"
      );

      await updateRouting(projectDir, componentName);
      await createCrud(projectKey, projectNameBack, selectedTable,database);

    }

    return res.json({
      success: true,
      message: "Components created successfully.",
    });
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).json({
      error: "An unexpected error occurred during the component creation process.",
    });
  }
}

function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

async function ensureDirectoryExists(directory) {
  try {
    const exists = await fs.stat(directory).then(() => true).catch(() => false);
    if (!exists) throw new Error(`${directory} does not exist.`);
  } catch (error) {
    throw new Error(`Failed to ensure directory exists: ${error.message}`);
  }
}

async function fileExists(filePath) {
  return fs.stat(filePath).then(() => true).catch(() => false);
}

function generateComponentContent(componentName, fields) {
  const formFields = fields
    .map(
      (field) => `
      <label for="${field.field}">${field.field}</label>
      <input
        id="${field.field}"
        type="${field.type === "number" ? "number" : "text"}"
        v-model="currentObject.${field.field}"
      />
    `
    )
    .join("\n");

  return `
<template>
  <div>
    <h2>${componentName} Management</h2>

    <div v-if="isCreating || isEditing">
      ${formFields}
      <button @click="isEditing ? update(currentObject.id) : create()">
        {{ isEditing ? 'Update' : 'Create' }}
      </button>
      <button @click="cancelEditing">Cancel</button>
    </div>

    <div>
      <button @click="startCreating">Add New ${componentName}</button>
      <ul>
        <li v-for="item in data" :key="item.id">
          <span v-for="(value, key) in item" :key="key">{{ key }}: {{ value }}</span>
          <button @click="edit(item)">Edit</button>
          <button @click="remove(item.id)">Delete</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import ${componentName}Service from "@/services/${componentName}Service";

export default {
  name: "${componentName}Component",
  data() {
    return {
      data: [],
      currentObject: {},
      isEditing: false,
      isCreating: false,
      message: '',
    };
  },
  methods: {
    async fetchAll() {
      try {
        const response = await ${componentName}Service.getAll();
        this.data = response.data;
      } catch (e) {
        console.error(e);
      }
    },
    async create() {
      try {
        const response = await ${componentName}Service.create(this.currentObject);
        this.data.push(response.data);
        this.currentObject = {};
        this.isCreating = false;
      } catch (e) {
        console.error(e);
      }
    },
    async update(id) {
      try {
        const response = await ${componentName}Service.update(id, this.currentObject);
        const index = this.data.findIndex(item => item.id === id);
        this.$set(this.data, index, response.data);
        this.currentObject = {};
        this.isEditing = false;
      } catch (e) {
        console.error(e);
      }
    },
    async remove(id) {
      try {
        await ${componentName}Service.delete(id);
        this.data = this.data.filter(item => item.id !== id);
      } catch (e) {
        console.error(e);
      }
    },
    edit(item) {
      this.currentObject = { ...item };
      this.isEditing = true;
      this.isCreating = false;
    },
    startCreating() {
      this.isCreating = true;
      this.isEditing = false;
      this.currentObject = {};
    },
    cancelEditing() {
      this.isEditing = false;
      this.isCreating = false;
      this.currentObject = {};
    }
  },
  mounted() {
    this.fetchAll();
  }
};
</script>

<style scoped>
/* Your component styles go here */
</style>
  `;
}

function generateServiceContent(serviceName, tableName) {
  const lowerCaseName = tableName.toLowerCase();
  const API_URL = `/${lowerCaseName}s`;

  return `
import axios from 'axios';

const http = axios.create({
  baseURL: "http://localhost:3003/api",
  headers: {
    "Content-type": "application/json"
  }
});

const ${serviceName} = {
  getAll() {
    return http.get("${API_URL}");
  },
  create(data) {
    return http.post("${API_URL}", data);
  },
  update(id, data) {
    return http.put(\`\${"${API_URL}"}/\${id}\`, data);
  },
  delete(id) {
    return http.delete(\`\${"${API_URL}"}/\${id}\`);
  }
};

export default ${serviceName};
`;
}

async function updateRouting( projectDir,componentName) {
  const routerFilePath = path.resolve(projectDir, "src", "router.js");
  const lowerCaseName = componentName.toLowerCase();
  const routeContent = `{
    path: "/${lowerCaseName}s",
    name: "${lowerCaseName}",
    component: () => import("./components/${componentName}Component.vue")
  }`;

  try {
    let routerFileContent = await fs.readFile(routerFilePath, "utf8").catch(() => "");

    if (!routerFileContent) {
      routerFileContent = `
import { createRouter, createWebHistory } from "vue-router";

const routes = [
  ${routeContent}
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
      `;
    } else if (routerFileContent.includes("routes: [")) {
      routerFileContent = routerFileContent.replace(/routes:\s*\[/, `routes: [\n    ${routeContent},`);
    }

    await fs.writeFile(routerFilePath, routerFileContent, "utf8");
    console.log(`Routes for ${componentName} have been added successfully!`);
  } catch (error) {
    console.error("An error occurred while updating routing:", error);
  }
}
