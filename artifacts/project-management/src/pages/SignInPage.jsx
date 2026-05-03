import { SignIn } from "@clerk/react";

const SignInPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <SignIn routing="hash" />
    </div>
  );
};

export default SignInPage;
