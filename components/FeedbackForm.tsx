import { useState } from 'react';
import { Image, Text, TextInput, View } from 'react-native';
import { useSubmitFeedback } from '../features/feedback/hooks';
import { pickEvidenceFromCamera, pickEvidenceFromGallery } from '../features/feedback/evidenceCapture';
import type { FeedbackCategory } from '../features/feedback/types';
import { Button } from './Button';
import { ErrorBanner } from './ErrorBanner';
import { PressableScale } from './PressableScale';
import { QuickActionButton } from './QuickActionButton';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  suggestion: 'Sugerencia',
};

/**
 * Standalone form (not the FullScreenFormModal chrome itself, same split as
 * RecurringIncomeForm) so Cuenta's "Reportar un problema o sugerencia" row
 * just wraps this in a FullScreenFormModal like every other section.
 */
export function FeedbackForm() {
  const submitFeedback = useSubmitFeedback();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const attachFromCamera = async () => {
    setFormError(null);
    setCameraLoading(true);
    try {
      const uri = await pickEvidenceFromCamera();
      if (uri) setImageUri(uri);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setCameraLoading(false);
    }
  };

  const attachFromGallery = async () => {
    setFormError(null);
    setGalleryLoading(true);
    try {
      const uri = await pickEvidenceFromGallery();
      if (uri) setImageUri(uri);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setGalleryLoading(false);
    }
  };

  const canSubmit = title.trim().length > 0 && description.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setFormError(null);
    setSubmitted(false);
    submitFeedback.mutate(
      { title, category, description, imageUri },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTitle('');
          setCategory('bug');
          setDescription('');
          setImageUri(null);
        },
        onError: (err) => setFormError((err as Error).message),
      }
    );
  };

  return (
    <View>
      <Text className="font-jakarta text-secondary mb-5">
        Cuéntanos qué encontraste. Mientras más detalle, más fácil es solucionarlo.
      </Text>

      {formError && <ErrorBanner message={formError} onRetry={() => setFormError(null)} actionLabel="Descartar" />}
      {submitted && <Text className="font-jakarta text-income mb-3">¡Gracias por ayudarnos a mejorar!</Text>}

      <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Título</Text>
      <TextInput
        className="font-jakarta border border-gray-200 rounded-xl px-3 py-2 mb-4"
        style={{ color: INPUT_TEXT_COLOR }}
        placeholder="Resume el problema o la idea en pocas palabras"
        placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
        selectionColor={INPUT_SELECTION_COLOR}
        cursorColor={INPUT_CURSOR_COLOR}
        value={title}
        onChangeText={setTitle}
        maxLength={100}
      />

      <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Categoría</Text>
      <View className="flex-row mb-4">
        <View style={{ flex: 1 }}>
          <PressableScale
            className={`py-2 rounded-l-xl border ${category === 'bug' ? 'bg-brand border-brand' : 'border-gray-200'}`}
            onPress={() => setCategory('bug')}
          >
            <Text className={`font-jakarta text-center ${category === 'bug' ? 'text-white' : 'text-black'}`}>
              {CATEGORY_LABELS.bug}
            </Text>
          </PressableScale>
        </View>
        <View style={{ flex: 1 }}>
          <PressableScale
            className={`py-2 rounded-r-xl border ${category === 'suggestion' ? 'bg-brand border-brand' : 'border-gray-200'}`}
            onPress={() => setCategory('suggestion')}
          >
            <Text className={`font-jakarta text-center ${category === 'suggestion' ? 'text-white' : 'text-black'}`}>
              {CATEGORY_LABELS.suggestion}
            </Text>
          </PressableScale>
        </View>
      </View>

      <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Descripción</Text>
      <TextInput
        className="font-jakarta border border-gray-200 rounded-xl px-3 py-2 mb-4"
        style={{ color: INPUT_TEXT_COLOR, minHeight: 100, textAlignVertical: 'top' }}
        placeholder="¿Qué pasó? ¿Qué esperabas que pasara?"
        placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
        selectionColor={INPUT_SELECTION_COLOR}
        cursorColor={INPUT_CURSOR_COLOR}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />

      <Text className="text-gray-400 text-xs font-jakarta-semibold uppercase mb-2">Evidencia (opcional)</Text>
      {imageUri ? (
        <View className="mb-4">
          <Image source={{ uri: imageUri }} className="w-full h-40 rounded-xl mb-2" resizeMode="cover" />
          <PressableScale onPress={() => setImageUri(null)} accessibilityRole="button" accessibilityLabel="Quitar imagen">
            <Text className="font-jakarta text-danger text-sm">Quitar imagen</Text>
          </PressableScale>
        </View>
      ) : (
        <View className="flex-row mb-4" style={{ gap: 10 }}>
          <QuickActionButton
            icon="camera-outline"
            label="Tomar foto"
            onPress={attachFromCamera}
            loading={cameraLoading}
            disabled={galleryLoading}
          />
          <QuickActionButton
            icon="image-outline"
            label="Elegir de galería"
            onPress={attachFromGallery}
            loading={galleryLoading}
            disabled={cameraLoading}
          />
        </View>
      )}

      <Button
        title="Enviar feedback"
        onPress={handleSubmit}
        loading={submitFeedback.isPending}
        disabled={!canSubmit || submitFeedback.isPending}
      />
    </View>
  );
}
