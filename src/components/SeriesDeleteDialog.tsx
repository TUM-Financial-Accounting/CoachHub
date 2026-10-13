import { useTranslation } from 'react-i18next';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { SeriesScope } from '../lib/recurrence';

interface SeriesDeleteDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onSelect: (scope: SeriesScope) => void;
  onClose: () => void;
}

export default function SeriesDeleteDialog({ isOpen, title, message, onSelect, onClose }: SeriesDeleteDialogProps) {
  const { t } = useTranslation();
  const options: { scope: SeriesScope; label: string; variant: 'secondary' | 'danger' }[] = [
    { scope: 'this', label: t('recurrence.deleteThis'), variant: 'secondary' },
    { scope: 'future', label: t('recurrence.deleteFuture'), variant: 'danger' },
    { scope: 'all', label: t('recurrence.deleteAll'), variant: 'danger' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-muted">{message}</p>
        <div className="flex flex-col gap-2">
          {options.map(o => (
            <Button key={o.scope} variant={o.variant} onClick={() => onSelect(o.scope)} className="w-full justify-start">
              {o.label}
            </Button>
          ))}
          <Button variant="ghost" onClick={onClose} className="w-full justify-center">{t('common.cancel')}</Button>
        </div>
      </div>
    </Modal>
  );
}
