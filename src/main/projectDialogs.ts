import { dialog, type OpenDialogOptions } from 'electron';

export const projectOpenDialogOptions: OpenDialogOptions = {
  properties: ['openFile'],
  filters: [{ name: 'Project Files', extensions: ['msp', 'json'] }],
};

export const showProjectOpenDialog = async (): Promise<string | null> => {
  const result = await dialog.showOpenDialog(projectOpenDialogOptions);
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
};
