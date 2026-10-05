import { useState } from 'react';
import { Text } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useSession } from '../lib/session';
import { type } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

// Provisoria (E1): solo marca la bienvenida como hecha. Los 3 pasos van en E3.
export default function Welcome() {
  const { colors } = useTheme();
  const { updateSettings } = useSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await updateSettings({ onboarded_at: new Date().toISOString() });
    } catch {
      setError('No pudimos guardar. Probá de nuevo.');
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={[type.displayOnb, { color: colors.text, marginTop: 48 }]} accessibilityRole="header">
        Toda tu plata en un solo lugar
      </Text>
      {error ? <Text style={[type.caption, { color: colors.error }]}>{error}</Text> : null}
      <Button title="Listo" variant="primary" onPress={finish} loading={saving} />
    </Screen>
  );
}
