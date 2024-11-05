import React, { useState, useEffect } from "react";
import axios from "axios";
import Loader from "../common/loader.jsx";
import TablesModal from "./tablesModal";
import Toaster from "../common/toaster";
import ProjectForm from "./projectForm";
import "../assets/css/App.css";

export default function CreateProject() {
  const [projectName, setProjectName] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [tables, setTables] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [techFront, setTechFront] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [database, setDatabase] = useState("");

  const combinedData = tables.flatMap((table) =>
    table.fields.map((field) => ({
      tableName: table.name,
      field: field.field,
      type: field.type,
      ...(field.pk && { pk: true }),             
      ...(field.autoIncrement && { autoIncrement: true }), 
      ...(field.fk && { fk: true })              
    }))
  );

  const handleSubmit = async (formData) => {
    const {
      projectName,
      techFront,
      techBack,
      database,
      host,
      username,
      password,
      port,
      namedb,
    } = formData;
    setTechFront(techFront);
    const dataConnect = { database, host, port, username, password, namedb };
    const dataGenerate = { projectName, techFront, techBack, database ,dataConnect };

    setProjectName(projectName);
    setDatabase(database)
    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:4000/connect",
        dataConnect
      );
      
      if (
        response.data.message &&
        response.data.message.includes("Successfully") &&
        response.status === 200
      ) {
        try {
          const response = await axios.post(
            "http://localhost:4000/generateProject",
            dataGenerate
          );
          
          setProjectKey(response.data.projectKey);
        } catch (error) {
          console.error("Error generating project:", error);
        }

        setTables(response.data.tables);
        setShowModal(true);
      }
    } catch (error) {
      console.error("Error fetching tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => setShowModal(false);

  const handleSubmitComponent = async (event) => {
    //event.preventDefault();
    const selectedTable = getSelectedTableData();
    if (!selectedTable) {
      console.error("No table selected or table data missing");
      return;
    }

    const requestData = {
      projectName: projectName,
      selectedTables: selectedTable,
      projectKey: projectKey,
      database :  database
    };
    setLoading(true);
    let response;
    try {
      setShowSuccessToast(false);
      if (techFront === "Angular") {
        response = await axios.post(
          "http://localhost:4000/componentAngular",
          requestData
        );
      } else if (techFront === "React") {
        response = await axios.post(
          "http://localhost:4000/componentReact",
          requestData
        );
      } else if (techFront === "Vue") {
        response = await axios.post(
          "http://localhost:4000/componentVue",
          requestData
        );
      }
      

      if (
        response.data.message &&
        response.data.message.includes("successfully") &&
        response.status === 200
      ) {
        console.log("component generated successfully");
        setShowSuccessToast(true);
      } else {
        console.error("Failed to generate component");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
      setSelectedTables([]);
      handleClose();

      try {
        const response = await axios.post(
          "http://localhost:4000/download",
          { projectName: projectName,
            projectKey: projectKey

           },
          {
            responseType: "blob", // Important for handling file downloads
          }
        );

        // Create a URL for the downloaded file
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${projectName}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url); // Clean up the URL object
      } catch (err) {
        //setError('Erreur lors du téléchargement du projet.');
        console.error("Erreur lors du téléchargement:", err);
      }
    }
  };

  const getSelectedTableData = () => {
    const distinctTables = [...new Set(selectedTables)];
    return distinctTables.map((tableName) => {
      const tableData = combinedData.filter(
        (data) => data.tableName === tableName
      );
      return {
        name: tableName,
        // fields: tableData.map((data) => ({
        //   field: data.field,
        //   type: data.type,
        // })),
        fields: tableData,
      };
    });
  };

  const areAllTablesSelected = () => {
    return combinedData.every((data) =>
      selectedTables.includes(data.tableName)
    );
  };

  const selectAll = () => {
    if (areAllTablesSelected()) {
      setSelectedTables([]);
    } else {
      const allTableNames = combinedData.map((data) => data.tableName);
      setSelectedTables(allTableNames);
    }
  };

  const isTableSelected = (tableName) => {
    return selectedTables.includes(tableName);
  };

  const onSelectTable = (e, tableName) => {
    if (e.target.checked) {
      setSelectedTables([...selectedTables, tableName]);
    } else {
      setSelectedTables(selectedTables.filter((name) => name !== tableName));
    }
  };

  return (
    <div className="wizard -lg">
      <Loader loading={loading} />

      <ProjectForm handleSubmit={handleSubmit} loading={loading} />

      <TablesModal
        showModal={showModal}
        handleClose={handleClose}
        combinedData={combinedData}
        areAllTablesSelected={areAllTablesSelected}
        selectAll={selectAll}
        isTableSelected={isTableSelected}
        onSelectTable={onSelectTable}
        handleSubmitComponent={handleSubmitComponent}
      />
      <Toaster showSuccessToast={showSuccessToast} />
    </div>
  );
}