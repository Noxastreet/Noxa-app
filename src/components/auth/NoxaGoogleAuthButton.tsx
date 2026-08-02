import { Image } from 'react-native';

import { NoxaButton } from '@/src/components/ui';

// Standard-color Google "G" from Google's official sign-in branding assets.
const GOOGLE_MARK = {
  uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAD7UlEQVQ4y32UTYiVVRjHf885573vnTsfOo0zGVlkJbYp1KJCKosKWgwNtEhdFJQFfVFiubCFCzXBFuVCiKBPIiRRI3IXlSUlYfnVIvwoGLMxtRn1zp175973fc+/xTijmfjA2Rz+z+/8eZ7nPMZFEZctgKZDZzpmUlg/sgGw+Yb1Yi5gfhQLv8vC17hkiyPfm4WeqFIH6WdvAxAmYVp9MzpaKlEwgM+XE8PtREsxAJs804RbAG6+8EtzV/4EtElFfgIQgAPQxzOg5Tu4qraaNPuApFiIiymmiceYgAqHzBHNW2F+VmFhVWFhnczKk8aCfirBAZ8yo/46vrySSLBoqHAgBwUNYFhGLrNpwrqjOQrzRAtHzdxmZ9acAtJl0Nt4jFLxsvkYZAIcFn1V0W9FfqvJjshcC6xXZg9Ec88U5sC55ywf32m+xAXgOc1iWraCJLZTilgi5BlC7lULtk2nk2xSbHDMYv5LETp2yFzZstZ+K3dR3rJxCmj6OX2JnLfILKHhoZrUOVN+MX922Ud+8U7igV7ufHI75icSpuejrDm0CQ+suuUVqr5yYUwMTPvavyLqIaIgBzL3JQVL9M2sult7CIAF66NZoAx44wphxICF23ACE3hFUu3gWDIFOy9MVbABmC+uGOcCWM95r4CaOI5wvbtU6BDzJO6ZHKLLGjRTQHFi1iRASGLXNfXL6XU5mJldlA9Byocl9UVEJpULac7ooL79P4zTZnbikvsyonuqIzDmCuUHmzGnFnOGY27HiqK/N8TK87v7LqY1MZZj3I+xCGORmd0nF9+TRWTCJko2GGoqvqhLi6oiGRGclHvwryJd/M7BTz9c8N069ibz4DsicHzSSLX9OOMhm1EZ71yY5GVCTHDyGO57+2OPzRop+HxEdscpGUMxcFwdQ4Pqee2Mn77tt8acVu4SREBZhSLrQtW7r04bPWvLzWnLylmnK+UVQkyHg5LH/cZHS9U97aqdkD0yFH1pSG0Mxa7OU7Hn4ZNZ301NS7NoXsh1KJZmq5jeL/k3otxANHOaXB7GZufCu+HwdRl/Nm37WflbTytdeTq2h5HYRTV2do3H9KmIW4ppGBWZkXVi9W581RVJiuQRIKf9sYhvpo32cTd3nqhA829XWn+Gyoaz6qyNqpO62mhRImJlSdeCbjCyHrOGw9WQH6UIo2TJ2L5maeyF8njH4V9XVCb24bK7IimqDdmMNTU6nm5Q+bFF2izwCLvQa4uYa+F8A/P1fxTq7+dJfUmp1ba73j6CmfGfrzmw60bGixJHNHdmPbb1Z0oGIm4+og/wwo8ppoOx6NpV5N1bo7X9QHV208duxp64F4B/AQoN64xS6GivAAAAAElFTkSuQmCC',
} as const;

type NoxaGoogleAuthButtonProps = {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  title?: string;
};

export function NoxaGoogleAuthButton({
  disabled = false,
  loading = false,
  onPress,
  title = 'Continue with Google',
}: NoxaGoogleAuthButtonProps) {
  return (
    <NoxaButton
      accessibilityHint="Opens Google account authentication"
      disabled={disabled}
      fullWidth
      leadingIcon={
        <Image
          accessibilityIgnoresInvertColors
          source={GOOGLE_MARK}
          style={{ width: 20, height: 20 }}
        />
      }
      loading={loading}
      onPress={onPress}
      title={title}
      variant="google"
    />
  );
}
