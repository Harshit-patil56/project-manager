import { UserProfile } from "@clerk/react";

const AccountPage = () => {
    return (
        <div className="flex justify-center py-10">
            <UserProfile routing="hash" />
        </div>
    );
};

export default AccountPage;
