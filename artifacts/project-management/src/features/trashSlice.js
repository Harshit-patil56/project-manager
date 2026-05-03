import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiFetch } from "../lib/api";

export const fetchTrashThunk = createAsyncThunk("trash/fetch", async () => {
    return await apiFetch("/api/trash");
});

export const restoreWorkspaceThunk = createAsyncThunk(
    "trash/restoreWorkspace",
    async (workspaceId) => {
        await apiFetch(`/api/workspaces/${workspaceId}/restore`, { method: "POST" });
        return workspaceId;
    }
);

export const restoreProjectThunk = createAsyncThunk(
    "trash/restoreProject",
    async (projectId) => {
        await apiFetch(`/api/projects/${projectId}/restore`, { method: "POST" });
        return projectId;
    }
);

export const restoreTaskThunk = createAsyncThunk(
    "trash/restoreTask",
    async (taskId) => {
        await apiFetch(`/api/tasks/${taskId}/restore`, { method: "POST" });
        return taskId;
    }
);

const trashSlice = createSlice({
    name: "trash",
    initialState: {
        workspaces: [],
        projects: [],
        tasks: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchTrashThunk.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTrashThunk.fulfilled, (state, action) => {
                state.loading = false;
                state.workspaces = action.payload.workspaces || [];
                state.projects = action.payload.projects || [];
                state.tasks = action.payload.tasks || [];
            })
            .addCase(fetchTrashThunk.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || "Failed to load trash";
            })
            .addCase(restoreWorkspaceThunk.fulfilled, (state, action) => {
                state.workspaces = state.workspaces.filter((ws) => ws.id !== action.payload);
            })
            .addCase(restoreProjectThunk.fulfilled, (state, action) => {
                state.projects = state.projects.filter((p) => p.id !== action.payload);
            })
            .addCase(restoreTaskThunk.fulfilled, (state, action) => {
                state.tasks = state.tasks.filter((t) => t.id !== action.payload);
            });
    },
});

export default trashSlice.reducer;
