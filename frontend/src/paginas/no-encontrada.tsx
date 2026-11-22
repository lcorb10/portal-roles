import { Compass } from "lucide-react";
import { Link } from "react-router";

import { Vacio } from "@/components/estados";
import { Button } from "@/components/ui/button";

export default function NoEncontrada() {
  return (
    <Vacio
      icono={Compass}
      titulo="Esta página no existe"
      descripcion="Revisa la dirección o vuelve a tu acceso."
      className="mt-10"
      accion={
        <Button asChild>
          <Link to="/mi-acceso">Ir a Mi acceso</Link>
        </Button>
      }
    />
  );
}
