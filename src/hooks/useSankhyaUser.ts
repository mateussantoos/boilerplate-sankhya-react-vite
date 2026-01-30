import { useState, useEffect } from "react";

export interface SankhyaUser {
  id: number;
  name: string;
}

export function useSankhyaUser() {
  const [user, setUser] = useState<SankhyaUser | null>(null);

  useEffect(() => {
    // Check for global Sankhya user info
    const info = (window as any).sankhyaUserInfo;
    if (info) {
      setUser({
        id: info.id,
        name: info.name || "Usuário Sankhya",
      });
    } else {
      // Fallback for dev mode or if not found
      setUser({
        id: 0,
        name: "Usuário Dev",
      });
    }
  }, []);

  return user;
}
