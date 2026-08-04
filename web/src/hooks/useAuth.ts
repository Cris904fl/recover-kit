import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getToken, setToken, clearToken } from "@/lib/auth";

export interface Me {
  id: string;
  email: string;
  role: "owner" | "member";
  store: { id: string; name: string; domain: string };
}

interface AuthResponse {
  token: string;
  user: { id: string; email: string; role: "owner" | "member"; storeId: string };
}

interface Credentials {
  email: string;
  password: string;
}

interface RegisterInput {
  storeName: string;
  domain: string;
  email: string;
  password: string;
}

/** Usuario autenticado actual (null mientras carga o si no hay sesion). */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/auth/me"),
    enabled: Boolean(getToken()),
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (creds: Credentials) => api.post<AuthResponse>("/auth/login", creds),
    onSuccess: (data) => {
      setToken(data.token);
      qc.invalidateQueries();
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<AuthResponse>("/auth/register", input),
    onSuccess: (data) => {
      setToken(data.token);
      qc.invalidateQueries();
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    clearToken();
    qc.clear();
  };
}
