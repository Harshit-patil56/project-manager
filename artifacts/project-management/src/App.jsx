import { useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Toaster } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { loadTheme } from "./features/themeSlice";
import { fetchWorkspaces } from "./features/workspaceSlice";
import { setTokenGetter } from "./lib/api";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import ProjectDetails from "./pages/ProjectDetails";
import TaskDetails from "./pages/TaskDetails";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import LandingPage from "./pages/LandingPage";
import AccountPage from "./pages/AccountPage";

function AuthBridge() {
    const { getToken, isSignedIn, isLoaded } = useAuth();
    const dispatch = useDispatch();
    const hasFetched = useRef(false);

    useEffect(() => {
        setTokenGetter(getToken);
        return () => setTokenGetter(null);
    }, [getToken]);

    useEffect(() => {
        if (isLoaded && isSignedIn && !hasFetched.current) {
            hasFetched.current = true;
            // Confirm a valid token is available before hitting the API
            getToken().then((token) => {
                if (token) {
                    dispatch(fetchWorkspaces());
                }
            });
        }
        if (isLoaded && !isSignedIn) {
            hasFetched.current = false;
        }
    }, [isLoaded, isSignedIn, dispatch, getToken]);

    return null;
}

function RequireAuth({ children }) {
    const { isSignedIn, isLoaded } = useAuth();
    if (!isLoaded) return null;
    if (!isSignedIn) return <Navigate to="/sign-in" replace />;
    return children;
}

function RedirectIfSignedIn({ children }) {
    const { isSignedIn, isLoaded } = useAuth();
    if (!isLoaded) return null;
    if (isSignedIn) return <Navigate to="/dashboard" replace />;
    return children;
}

const App = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(loadTheme());
    }, [dispatch]);

    return (
        <>
            <Toaster />
            <AuthBridge />
            <Routes>
                <Route
                    path="/"
                    element={
                        <RedirectIfSignedIn>
                            <LandingPage />
                        </RedirectIfSignedIn>
                    }
                />

                <Route path="/sign-in/*" element={<SignInPage />} />
                <Route path="/sign-up/*" element={<SignUpPage />} />

                <Route
                    element={
                        <RequireAuth>
                            <Layout />
                        </RequireAuth>
                    }
                >
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="team" element={<Team />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projectsDetail" element={<ProjectDetails />} />
                    <Route path="taskDetails" element={<TaskDetails />} />
                    <Route path="account" element={<AccountPage />} />
                </Route>
            </Routes>
        </>
    );
};

export default App;
