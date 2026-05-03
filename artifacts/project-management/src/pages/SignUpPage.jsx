import { SignUp } from "@clerk/react";

const SignUpPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <SignUp routing="hash" />
    </div>
  );
};

export default SignUpPage;
