import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '@/store/store';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';

export function ResetDemoButton({ variant = 'ghost', label = 'Reset demo data', className }: { variant?: 'ghost' | 'secondary'; label?: string; className?: string }) {
  const reset = useStore((s) => s.resetDemo);
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirm(true)} className={className}>
        {label}
      </Button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset all demo data?"
        description={
          <>
            This removes every invoice, payment, customer and setting you created in this browser and restores the original sample dataset for all four industries.
          </>
        }
        confirmLabel="Reset demo"
        onConfirm={() => {
          reset();
          toast.success('Demo data restored', 'The original sample dataset has been reloaded.');
        }}
      />
    </>
  );
}
