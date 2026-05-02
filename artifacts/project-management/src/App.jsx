import { Routes, Route, Navigate } from "react-router-dom";
import { Show } from "@clerk/react";
import { Toaster } from "react-hot-toast";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import ProjectDetails from "./pages/ProjectDetails";
import TaskDetails from "./pages/TaskDetails";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import LandingPage from "./pages/LandingPage";

const App = () => {
    return (
        <>
            <Toaster />
            <Routes>
                {/* Public landing page */}
                <Route
                    path="/"
                    element={
                        <>
                            <Show when="signed-in">
                                <Navigate to="/dashboard" replace />
                            </Show>
                            <Show when="signed-out">
                                <LandingPage />
                            </Show>
                        </>
                    }
                />

                {/* Auth routes */}
                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/sign-up/*" element={<SignUpPage />} />

                {/* Protected app routes */}
                <Route
                    element={
                        <>
                            <Show when="signed-in">
                                <Layout />
                            </Show>
                            <Show when="signed-out">
                                <Navigate to="/sign-in" replace />
                            </Show>
                        </>
                    }
                >
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="team" element={<Team />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projectsDetail" element={<ProjectDetails />} />
                    <Route path="taskDetails" element={<TaskDetails />} />
                </Route>
            </Routes>
        </>
    );
};

export default App;
