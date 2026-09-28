function currentLanguage() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (locale.startsWith('ru')) return 'ru';
  if (locale.startsWith('el')) return 'el';
  return 'en';
}

export function driveTogetherRouteChangedMessage(displayName: string) {
  const name = displayName.trim() || 'NOXA driver';
  switch (currentLanguage()) {
    case 'ru':
      return `${name}: маршрут изменён`;
    case 'el':
      return `${name}: η διαδρομή άλλαξε`;
    default:
      return `${name}: route changed`;
  }
}
