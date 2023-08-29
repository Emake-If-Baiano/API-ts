export default interface Nota {
    disciplina: string;
    nota_etapa_1: { nota: number };
    nota_etapa_2: { nota: number };
    nota_avaliacao_final?: { nota: number };
    numero_faltas: number;
    codigo_diario: string;
    situacao: string
}