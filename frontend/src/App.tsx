import { useEffect, useState } from "react";

export default function App() {
  const [estado, setEstado] = useState("consultando…");
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setEstado(`${d.estado} · base de datos: ${d.base_de_datos}`))
      .catch(() => setEstado("sin conexión con el backend"));
  }, []);
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 text-slate-100">
      <p>Portal de Roles — backend: {estado}</p>
    </main>
  );
}
