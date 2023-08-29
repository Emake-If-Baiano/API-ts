import User from "./User";

import Material from "./Material";

export default interface Turma {
    id: string;
    usersIn: User[];
    materiais_de_aula: Material[];
    componente_curricular: string;
}