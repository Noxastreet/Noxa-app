import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

type UnsavedChangesGuardOptions = {
  hasUnsavedChanges: boolean;
  isBusy?: boolean;
};

export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  isBusy = false,
}: UnsavedChangesGuardOptions) {
  const navigation = useNavigation();
  const pendingNavigationRef = useRef<null | (() => void)>(null);
  const [bypass, setBypass] = useState(false);

  const navigateWithoutPrompt = useCallback((navigate: () => void) => {
    pendingNavigationRef.current = navigate;
    setBypass(true);
  }, []);

  useEffect(() => {
    if (!bypass) return;

    const navigate = pendingNavigationRef.current;
    if (!navigate) {
      setBypass(false);
      return;
    }

    pendingNavigationRef.current = null;
    navigate();

    const reset = setTimeout(() => setBypass(false), 0);
    return () => clearTimeout(reset);
  }, [bypass]);

  usePreventRemove((hasUnsavedChanges || isBusy) && !bypass, ({ data }) => {
    if (isBusy) {
      Alert.alert(
        'Saving changes…',
        'Wait for the save to finish before leaving this screen.',
      );
      return;
    }

    Alert.alert(
      'Discard changes?',
      'You have unsaved changes. If you leave now, they will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            navigateWithoutPrompt(() => navigation.dispatch(data.action)),
        },
      ],
    );
  });

  return { navigateWithoutPrompt };
}
