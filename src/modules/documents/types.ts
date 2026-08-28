export type DocumentStatus = 'Recebido' | 'Pendente' | 'Faltando';

export interface ClientDocument {
  id: string;
  clientId: string;
  documentType: string;
  status: DocumentStatus;
  fileName?: string;
  fileType?: string; // 'application/pdf' | 'image/png' | 'image/jpeg'
  fileData?: string; // Base64 representation of file
  uploadedAt?: string; // ISO string
  uploadedBy?: string; // Responsible user
}

export const REQUIRED_DOCUMENTS = [
  'RG',
  'CPF',
  'Comprovante de Endereço',
  'Holerite 1',
  'Holerite 2',
  'Holerite 3',
  'Carteira de Trabalho',
  'Extrato FGTS',
  'Certidão Civil',
  'Declaração de Imposto de Renda'
];
