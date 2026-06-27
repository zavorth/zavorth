export type DesktopNotificationOptions = {
  title: string;
  body: string;
  silent?: boolean;
};

export async function sendDesktopNotification(options: DesktopNotificationOptions): Promise<boolean> {
  if (!window.zavorthDesktop?.sendNotification) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(options.title, {
        body: options.body,
        silent: options.silent,
      });
      return true;
    }
    return false;
  }

  try {
    const result = await window.zavorthDesktop.sendNotification(options);
    return Boolean(result?.ok);
  } catch {
    return false;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!window.zavorthDesktop?.getNotificationPermission) {
    if (typeof Notification !== 'undefined' && 'permission' in Notification) {
      if (Notification.permission === 'default') {
        return await Notification.requestPermission();
      }
      return Notification.permission;
    }
    return 'unsupported';
  }

  try {
    const perm = await window.zavorthDesktop.getNotificationPermission();
    return perm as NotificationPermission | 'unsupported';
  } catch {
    return 'unsupported';
  }
}
