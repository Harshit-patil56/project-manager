import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiFetch } from "../lib/api";

export const fetchWorkspaces = createAsyncThunk(
  "workspace/fetchAll",
  async () => {
    const workspaces = await apiFetch("/api/workspaces");
    if (!workspaces || workspaces.length === 0) return [];
    const populated = await Promise.all(
      workspaces.map(async (ws) => {
        const [full, projectsBasic] = await Promise.all([
          apiFetch(`/api/workspaces/${ws.id}`),
          apiFetch(`/api/workspaces/${ws.id}/projects`),
        ]);
        const projects = await Promise.all(
          (projectsBasic || []).map((p) => apiFetch(`/api/projects/${p.id}`))
        );
        return { ...full, projects };
      })
    );
    return populated;
  }
);

export const createProjectThunk = createAsyncThunk(
  "workspace/createProject",
  async ({ workspaceId, ...data }) => {
    const project = await apiFetch(`/api/workspaces/${workspaceId}/projects`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return project;
  }
);

export const updateProjectThunk = createAsyncThunk(
  "workspace/updateProject",
  async ({ projectId, ...data }) => {
    return await apiFetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
);

export const createTaskThunk = createAsyncThunk(
  "workspace/createTask",
  async ({ projectId, ...data }) => {
    return await apiFetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
);

export const updateTaskThunk = createAsyncThunk(
  "workspace/updateTask",
  async ({ taskId, ...data }) => {
    return await apiFetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
);

export const deleteTasksThunk = createAsyncThunk(
  "workspace/deleteTasks",
  async ({ taskIds, projectId }) => {
    await Promise.all(
      taskIds.map((id) => apiFetch(`/api/tasks/${id}`, { method: "DELETE" }))
    );
    return { taskIds, projectId };
  }
);

export const addProjectMemberThunk = createAsyncThunk(
  "workspace/addProjectMember",
  async ({ projectId, userId }) => {
    const member = await apiFetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
    return { projectId, member };
  }
);

export const addCommentThunk = createAsyncThunk(
  "workspace/addComment",
  async ({ taskId, projectId, content }) => {
    const comment = await apiFetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    return { comment, taskId, projectId };
  }
);

const initialState = {
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  error: null,
};

function updateProjectInState(state, project) {
  if (state.currentWorkspace?.id === project.workspaceId) {
    state.currentWorkspace.projects = state.currentWorkspace.projects.map((p) =>
      p.id === project.id ? { ...project, tasks: p.tasks || [] } : p
    );
  }
  state.workspaces = state.workspaces.map((ws) =>
    ws.id === project.workspaceId
      ? {
          ...ws,
          projects: ws.projects.map((p) =>
            p.id === project.id ? { ...project, tasks: p.tasks || [] } : p
          ),
        }
      : ws
  );
}

function updateTaskInState(state, task) {
  const updateInProjects = (projects) =>
    projects.map((p) =>
      p.id === task.projectId
        ? {
            ...p,
            tasks: p.tasks.map((t) => (t.id === task.id ? task : t)),
          }
        : p
    );

  if (state.currentWorkspace) {
    state.currentWorkspace.projects = updateInProjects(
      state.currentWorkspace.projects
    );
  }
  state.workspaces = state.workspaces.map((ws) => ({
    ...ws,
    projects: updateInProjects(ws.projects),
  }));
}

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setWorkspaces: (state, action) => {
      state.workspaces = action.payload;
    },
    setCurrentWorkspace: (state, action) => {
      const id = action.payload;
      localStorage.setItem("currentWorkspaceId", id);
      const ws = state.workspaces.find((w) => w.id === id);
      if (ws) state.currentWorkspace = ws;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWorkspaces.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaces.fulfilled, (state, action) => {
        state.loading = false;
        state.workspaces = action.payload;
        const savedId = localStorage.getItem("currentWorkspaceId");
        const saved = action.payload.find((w) => w.id === savedId);
        state.currentWorkspace = saved || action.payload[0] || null;
      })
      .addCase(fetchWorkspaces.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to load workspaces";
      })

      .addCase(createProjectThunk.fulfilled, (state, action) => {
        const project = { ...action.payload, tasks: [] };
        if (state.currentWorkspace?.id === project.workspaceId) {
          state.currentWorkspace.projects.push(project);
        }
        state.workspaces = state.workspaces.map((ws) =>
          ws.id === project.workspaceId
            ? { ...ws, projects: [...(ws.projects || []), project] }
            : ws
        );
      })

      .addCase(updateProjectThunk.fulfilled, (state, action) => {
        updateProjectInState(state, action.payload);
      })

      .addCase(createTaskThunk.fulfilled, (state, action) => {
        const task = action.payload;
        const addTask = (projects) =>
          projects.map((p) =>
            p.id === task.projectId
              ? { ...p, tasks: [...(p.tasks || []), task] }
              : p
          );
        if (state.currentWorkspace) {
          state.currentWorkspace.projects = addTask(
            state.currentWorkspace.projects
          );
        }
        state.workspaces = state.workspaces.map((ws) => ({
          ...ws,
          projects: addTask(ws.projects),
        }));
      })

      .addCase(updateTaskThunk.fulfilled, (state, action) => {
        updateTaskInState(state, action.payload);
      })

      .addCase(deleteTasksThunk.fulfilled, (state, action) => {
        const { taskIds, projectId } = action.payload;
        const removeTasks = (projects) =>
          projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.filter((t) => !taskIds.includes(t.id)) }
              : p
          );
        if (state.currentWorkspace) {
          state.currentWorkspace.projects = removeTasks(
            state.currentWorkspace.projects
          );
        }
        state.workspaces = state.workspaces.map((ws) => ({
          ...ws,
          projects: removeTasks(ws.projects),
        }));
      })

      .addCase(addProjectMemberThunk.fulfilled, (state, action) => {
        const { projectId, member } = action.payload;
        const addMember = (projects) =>
          projects.map((p) =>
            p.id === projectId
              ? { ...p, members: [...(p.members || []), member] }
              : p
          );
        if (state.currentWorkspace) {
          state.currentWorkspace.projects = addMember(state.currentWorkspace.projects);
        }
        state.workspaces = state.workspaces.map((ws) => ({
          ...ws,
          projects: addMember(ws.projects),
        }));
      })

      .addCase(addCommentThunk.fulfilled, (state, action) => {
        const { comment, taskId, projectId } = action.payload;
        const addComment = (projects) =>
          projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  tasks: p.tasks.map((t) =>
                    t.id === taskId
                      ? { ...t, comments: [...(t.comments || []), comment] }
                      : t
                  ),
                }
              : p
          );
        if (state.currentWorkspace) {
          state.currentWorkspace.projects = addComment(
            state.currentWorkspace.projects
          );
        }
        state.workspaces = state.workspaces.map((ws) => ({
          ...ws,
          projects: addComment(ws.projects),
        }));
      });
  },
});

export const { setWorkspaces, setCurrentWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;
