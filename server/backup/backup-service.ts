export interface BackupService {
  runBackup(connectionName: string): Promise<{ backupId: string }>;
  runRestore(connectionName: string, backupId: string): Promise<void>;
}

export const backupService: BackupService = {
  async runBackup(connectionName) {
    return { backupId: `${connectionName}-${Date.now()}` };
  },
  async runRestore() {
    return;
  },
};
