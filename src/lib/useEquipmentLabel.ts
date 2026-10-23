import { useTranslation } from 'react-i18next';
import { equipmentKey } from './domain';

// Translates known equipment; anything typed by hand is shown as typed.
export function useEquipmentLabel(): (item: string) => string {
  const { t } = useTranslation();
  return (item: string) => {
    const key = equipmentKey(item);
    return key ? t(`equipment.${key}` as never) : item;
  };
}
