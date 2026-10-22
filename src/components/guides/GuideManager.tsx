import React, { useState, useEffect } from 'react';
import { GuideSummary } from '../../types/guide';
import { GuideList } from './GuideList';
import { GuideEditor } from './GuideEditor';
import { DeleteGuideModal } from './DeleteGuideModal';
import { GuideBackupsModal } from './GuideBackupsModal';

export const GuideManager: React.FC = () => {
  const [guides, setGuides] = useState<GuideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGuideSlug, setActiveGuideSlug] = useState<string | null>(null);

  // Modals
  const [deleteModalGuide, setDeleteModalGuide] = useState<GuideSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBackupsModal, setShowBackupsModal] = useState(false);

  const fetchGuides = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/guides');
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.guides)) {
        setGuides(data.guides);
      } else {
        throw new Error(data.error || 'Invalid guide data received from server');
      }
    } catch (err: any) {
      // If temporary network interruption during startup/restart, retry once after 1s
      if (retryCount < 2) {
        setTimeout(() => {
          fetchGuides(retryCount + 1);
        }, 1000);
        return;
      }
      setError(err?.message || 'Unable to connect to the gift guides API.');
    } finally {
      if (retryCount >= 2 || !error) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteModalGuide) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/guides/${deleteModalGuide.slug}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDeleteModalGuide(null);
        await fetchGuides();
      } else {
        alert(data.error || 'Failed to delete guide');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting guide');
    } finally {
      setIsDeleting(false);
    }
  };

  if (activeGuideSlug !== null) {
    return (
      <GuideEditor
        guideSlug={activeGuideSlug}
        onBack={() => {
          setActiveGuideSlug(null);
          fetchGuides();
        }}
        onSaved={(newSlug) => {
          setActiveGuideSlug(newSlug);
          fetchGuides();
        }}
      />
    );
  }

  return (
    <>
      <GuideList
        guides={guides}
        loading={loading}
        error={error}
        onRetry={() => fetchGuides(0)}
        onSelectGuide={(slug) => setActiveGuideSlug(slug)}
        onCreateGuide={() => setActiveGuideSlug('new')}
        onDeleteGuide={(g) => setDeleteModalGuide(g)}
        onOpenBackups={() => setShowBackupsModal(true)}
      />

      <DeleteGuideModal
        guide={deleteModalGuide}
        isOpen={deleteModalGuide !== null}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalGuide(null)}
      />

      <GuideBackupsModal
        isOpen={showBackupsModal}
        onClose={() => setShowBackupsModal(false)}
        onRestoreSuccess={() => {
          setShowBackupsModal(false);
          fetchGuides();
        }}
      />
    </>
  );
};
