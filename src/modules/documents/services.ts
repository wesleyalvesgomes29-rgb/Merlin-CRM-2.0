import { ClientDocument, DocumentStatus, REQUIRED_DOCUMENTS } from './types';
import { getStoredDocuments, saveStoredDocuments } from './storage';

export const documentService = {
  /**
   * Retrieves all 10 required documents for a client.
   * If a document has not been uploaded yet, returns a default virtual document with status 'Faltando'.
   */
  getClientDocuments(clientId: string): ClientDocument[] {
    const allDocs = getStoredDocuments();
    const clientDocs = allDocs.filter(d => d.clientId === clientId);
    
    return REQUIRED_DOCUMENTS.map(docType => {
      const existing = clientDocs.find(d => d.documentType === docType);
      if (existing) {
        return existing;
      }
      return {
        id: `virtual-${clientId}-${docType.replace(/\s+/g, '_')}`,
        clientId,
        documentType: docType,
        status: 'Faltando'
      };
    });
  },

  /**
   * Updates a document's status (useful for marking non-uploaded files as Pendente or Faltando).
   */
  updateDocumentStatus(clientId: string, documentType: string, status: DocumentStatus): ClientDocument[] {
    const allDocs = getStoredDocuments();
    const existingIndex = allDocs.findIndex(d => d.clientId === clientId && d.documentType === documentType);
    
    if (existingIndex > -1) {
      allDocs[existingIndex].status = status;
      // If we are changing the status to something other than 'Recebido', clear the file data
      if (status !== 'Recebido') {
        allDocs[existingIndex].fileName = undefined;
        allDocs[existingIndex].fileType = undefined;
        allDocs[existingIndex].fileData = undefined;
        allDocs[existingIndex].uploadedAt = undefined;
        allDocs[existingIndex].uploadedBy = undefined;
      }
    } else {
      allDocs.push({
        id: Math.random().toString(),
        clientId,
        documentType,
        status
      });
    }
    
    saveStoredDocuments(allDocs);
    return this.getClientDocuments(clientId);
  },

  /**
   * Registers a document upload with its file information and Base64 content, setting status to 'Recebido'
   */
  uploadDocument(
    clientId: string,
    documentType: string,
    fileName: string,
    fileType: string,
    fileData: string
  ): ClientDocument[] {
    const allDocs = getStoredDocuments();
    const existingIndex = allDocs.findIndex(d => d.clientId === clientId && d.documentType === documentType);
    
    const newDoc: ClientDocument = {
      id: existingIndex > -1 ? allDocs[existingIndex].id : Math.random().toString(),
      clientId,
      documentType,
      status: 'Recebido',
      fileName,
      fileType,
      fileData,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Wesley (Corretor)'
    };

    if (existingIndex > -1) {
      allDocs[existingIndex] = newDoc;
    } else {
      allDocs.push(newDoc);
    }

    saveStoredDocuments(allDocs);
    return this.getClientDocuments(clientId);
  },

  /**
   * Deletes a document file, resetting its status back to 'Faltando'.
   */
  deleteDocument(clientId: string, documentType: string): ClientDocument[] {
    const allDocs = getStoredDocuments();
    const existingIndex = allDocs.findIndex(d => d.clientId === clientId && d.documentType === documentType);
    
    if (existingIndex > -1) {
      allDocs[existingIndex] = {
        id: allDocs[existingIndex].id,
        clientId,
        documentType,
        status: 'Faltando'
      };
    }
    
    saveStoredDocuments(allDocs);
    return this.getClientDocuments(clientId);
  }
};
