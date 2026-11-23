import { Link } from "react-router";

import { Vacio } from "@/components/estados";
import { Button } from "@/components/ui/button";

export default function NoEncontrada() {
  return (
    <Vacio
      ilustracion="no-encontrada"
      titulo="Esta página no existe"
      descripcion="Revisa la dirección o vuelve al inicio. También puedes buscar con Ctrl + K."
      className="mt-10"
      accion={
        <Button asChild>
          <Link to="/inicio">Ir al inicio</Link>
        </Button>
      }
    />
  );
}
