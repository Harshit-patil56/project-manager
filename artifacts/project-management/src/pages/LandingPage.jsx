import { useNavigate } from "react-router-dom";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="mb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-white shadow-lg overflow-hidden">
          <img src="/src/assets/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900">Project Management</h1>
        <p className="mt-3 text-lg text-gray-500">Manage workspaces, projects, and tasks — all in one place.</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => navigate(`${basePath}/sign-in`)}
          className="rounded-lg bg-blue-500 px-6 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-600 transition-colors"
        >
          Sign In
        </button>
        <button
          onClick={() => navigate(`${basePath}/sign-up`)}
          className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Create Account
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
