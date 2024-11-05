import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Home from './HOME/home';
import CreateProject from './FIRST_PLAN/createProject';
import Recommandation from './FIRST_PLAN/recommended';
import "bootstrap/dist/css/bootstrap.min.css";


function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recommandation" element={<Recommandation />} />
          <Route path="/create" element={<CreateProject />} />
        </Routes>
      </div>
    </Router>

  );
}

export default App;
