import React, { useState } from "react";
import { auth, provider, signInWithPopup, signOut } from "./firebase";
import PlanForm from "./components/PlanForm";

export default function App() {
  const [user, setUser] = useState(null);

  const login = async () => {
    const res = await signInWithPopup(auth, provider);
    setUser(res.user);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-200 to-blue-200">
      {!user ? (
        <button onClick={login} className="bg-black text-white px-4 py-2 rounded">
          Sign in with Google
        </button>
      ) : (
        <PlanForm user={user} />
      )}
    </div>
  );
}
