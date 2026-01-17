import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Camera, MapPin, AlertTriangle, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

// Helper to convert base64 to blob URL (more memory efficient for mobile)
const base64ToBlobUrl = (base64String: string, mimeType: string = 'image/jpeg'): { blobUrl: string; file: File } => {
  const byteCharacters = atob(base64String);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const file = new File([blob], `image-${Date.now()}.jpg`, { type: mimeType });
  return { blobUrl, file };
};

type Category = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

type ProblemType = {
  id: string;
  code: string;
  name: string;
  category_id: string;
};

type DuplicateTicket = {
  id: string;
  ticket_number: number;
  location: string;
  status: string;
  created_at: string;
};

const STEPS = ['Valdkond', 'Probleem', 'Asukoht', 'Esita'];

export default function SubmitTicket() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [problemTypes, setProblemTypes] = useState<ProblemType[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<ProblemType | null>(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateTicket[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Cleanup blob URLs when component unmounts or URLs change
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchProblemTypes(selectedCategory.id);
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');
    if (!error && data) setCategories(data);
  };

  const fetchProblemTypes = async (categoryId: string) => {
    const { data, error } = await supabase
      .from('problem_types')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order');
    if (!error && data) setProblemTypes(data);
  };

  const checkDuplicates = async () => {
    if (!selectedProblem || !location.trim()) return;

    const cleanLocation = location.trim();
    if (cleanLocation.length < 2 || cleanLocation.length > 200) {
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('tickets')
      .select('id, ticket_number, location, status, created_at')
      .eq('problem_type_id', selectedProblem.id)
      .eq('location_key', cleanLocation.toLowerCase())
      .in('status', ['submitted', 'in_progress'])
      .gte('created_at', sevenDaysAgo.toISOString());

    if (!error && data && data.length > 0) {
      setDuplicates(data);
      setShowDuplicateWarning(true);
    } else {
      setDuplicates([]);
      setShowDuplicateWarning(false);
    }
  };

  const handleLocationBlur = () => {
    if (location.trim()) {
      checkDuplicates();
    }
  };

  const handleImageCapture = async () => {
    if (selectedImages.length >= 3) {
      toast.error('Saad lisada maksimaalselt 3 pilti');
      return;
    }

    try {
      toast.info('Avan kaamera...');
      
      const image = await CapCamera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt,
        saveToGallery: false,
        width: 1200,
        height: 1200,
      });

      if (image.base64String) {
        // Use blob URL instead of base64 for better mobile performance
        const { blobUrl, file } = base64ToBlobUrl(image.base64String);
        
        console.log('Image captured, blob URL created:', blobUrl.substring(0, 50));
        
        setImagePreviewUrls(prev => [...prev, blobUrl]);
        setSelectedImages(prev => [...prev, file]);
        toast.success('Pilt lisatud!');
      } else {
        toast.error('Pilti ei saadud');
      }
    } catch (error: any) {
      if (error.message?.includes('cancelled') || error.message?.includes('User cancelled')) {
        // User cancelled - no error needed
      } else {
        logger.error('Image capture failed', error);
        toast.error(`Pildi valimine ebaõnnestus: ${error.message || 'Tundmatu viga'}`);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 3 - selectedImages.length;
    const newFiles = files.slice(0, remainingSlots);
    
    if (newFiles.length === 0) {
      toast.error('Palun vali korrektne pilt');
      return;
    }
    
    setSelectedImages(prev => [...prev, ...newFiles]);
    
    // Use blob URLs for better performance
    newFiles.forEach(file => {
      const blobUrl = URL.createObjectURL(file);
      console.log('File selected, blob URL created:', blobUrl.substring(0, 50));
      setImagePreviewUrls(prev => [...prev, blobUrl]);
    });
    
    e.target.value = '';
  };

  const removeImage = useCallback((index: number) => {
    // Revoke the blob URL to free memory
    const urlToRemove = imagePreviewUrls[index];
    if (urlToRemove?.startsWith('blob:')) {
      URL.revokeObjectURL(urlToRemove);
    }
    
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  }, [imagePreviewUrls]);

  const handleSubmit = async (addToDuplicate?: string) => {
    if (!user || !selectedCategory || !selectedProblem || !location.trim()) return;

    setSubmitting(true);
    try {
      const isSafetyRelated = selectedCategory.name === 'Ohutus ja töökeskkond';

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          category_id: selectedCategory.id,
          problem_type_id: selectedProblem.id,
          location: location.trim(),
          description: description.trim() || null,
          created_by: user.id,
          is_safety_related: isSafetyRelated,
          duplicate_of: addToDuplicate || null,
          duplicate_reason: addToDuplicate ? null : (duplicateReason || null),
        })
        .select()
        .single();

      if (error) throw error;

      if (selectedImages.length > 0 && data) {
        const uploadedImagePaths: string[] = [];
        console.log('Uploading', selectedImages.length, 'images for ticket', data.id);
        
        for (const file of selectedImages) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${data.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          console.log('Uploading file:', fileName, 'size:', file.size);
          
          const { error: uploadError } = await supabase.storage
            .from('ticket-images')
            .upload(fileName, file);
          
          if (!uploadError) {
            uploadedImagePaths.push(fileName);
            console.log('Upload success:', fileName);
          } else {
            console.error('Upload error:', uploadError);
            logger.error('Failed to upload image', uploadError);
          }
        }
        
        console.log('Uploaded paths:', uploadedImagePaths);
        
        if (uploadedImagePaths.length > 0) {
          const { error: updateError } = await supabase
            .from('tickets')
            .update({ images: uploadedImagePaths })
            .eq('id', data.id);
          
          if (updateError) {
            console.error('Failed to update ticket with images:', updateError);
          } else {
            console.log('Ticket updated with images');
          }
        }
      }

      if (data?.id) {
        const { error: notifyError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            ticketId: data.id,
            notificationType: 'created',
          },
        });

        if (notifyError) {
          logger.warn('Failed to send push notification for ticket', notifyError);
        }
      }

      toast.success('Teade edukalt esitatud!');
      navigate('/my-tickets');
    } catch (error) {
      logger.error('Failed to submit ticket', error);
      toast.error('Teate esitamine ebaõnnestus. Palun proovi uuesti.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedCategory;
      case 1: return !!selectedProblem;
      case 2: return location.trim().length > 0;
      case 3: return !showDuplicateWarning || duplicateReason.trim().length > 0;
      default: return false;
    }
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Uus teade</h1>
      </div>

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex-1 h-1 rounded-full transition-colors",
              i <= step ? "bg-orange-500" : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Samm {step + 1}/{STEPS.length}: {STEPS[step]}
      </p>

      {step === 0 && (
        <div className="grid gap-3">
          {categories.map((cat) => (
            <Card
              key={cat.id}
              className={cn(
                "cursor-pointer transition-all",
                selectedCategory?.id === cat.id
                  ? "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950"
                  : "hover:bg-muted"
              )}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedProblem(null);
              }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="text-2xl">
                  {cat.icon === 'building' && '🏫'}
                  {cat.icon === 'trees' && '🌳'}
                  {cat.icon === 'shield-alert' && '⚠️'}
                  {cat.icon === 'wrench' && '🔧'}
                  {cat.icon === 'package' && '📦'}
                </div>
                <div>
                  <p className="font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
                {selectedCategory?.id === cat.id && (
                  <Check className="ml-auto h-5 w-5 text-orange-500" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-2">
          {problemTypes.map((pt) => (
            <Card
              key={pt.id}
              className={cn(
                "cursor-pointer transition-all",
                selectedProblem?.id === pt.id
                  ? "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950"
                  : "hover:bg-muted"
              )}
              onClick={() => setSelectedProblem(pt)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <p className="font-medium">{pt.name}</p>
                {selectedProblem?.id === pt.id && (
                  <Check className="h-5 w-5 text-orange-500" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Asukoht (kohustuslik)
            </label>
            <Input
              placeholder="nt Koridor 2. korrus, klass 205, WC meeste 1. korrus..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={handleLocationBlur}
              className="text-base"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Lisainfo (valikuline)
            </label>
            <Textarea
              placeholder="Kirjelda probleemi täpsemalt..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {imagePreviewUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {imagePreviewUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img 
                    src={url} 
                    alt={`Pilt ${index + 1}`} 
                    className="w-full h-20 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {selectedImages.length < 3 && (
            <div>
              {Capacitor.isNativePlatform() ? (
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  type="button"
                  onClick={handleImageCapture}
                >
                  <Camera className="h-4 w-4" />
                  Lisa pilt ({selectedImages.length}/3)
                </Button>
              ) : (
                <>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    multiple={selectedImages.length < 2}
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    type="button"
                    onClick={() => document.getElementById('image-upload')?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    Lisa pilt ({selectedImages.length}/3)
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Teate kokkuvõte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Valdkond:</span> {selectedCategory?.name}</p>
              <p><span className="text-muted-foreground">Probleem:</span> {selectedProblem?.name}</p>
              <p><span className="text-muted-foreground">Asukoht:</span> {location}</p>
              {description && <p><span className="text-muted-foreground">Lisainfo:</span> {description}</p>}
              {imagePreviewUrls.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Pildid:</span>
                  <div className="flex gap-2 mt-1">
                    {imagePreviewUrls.map((url, index) => (
                      <img 
                        key={index}
                        src={url} 
                        alt={`Pilt ${index + 1}`}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {showDuplicateWarning && duplicates.length > 0 && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                  <AlertTriangle className="h-5 w-5" />
                  <p className="font-medium">Sarnane teade on juba esitatud!</p>
                </div>
                <div className="text-sm space-y-2">
                  {duplicates.map((d) => (
                    <div key={d.id} className="flex items-center justify-between bg-background rounded p-2">
                      <span>#{d.ticket_number} - {d.location}</span>
                      <Button size="sm" variant="outline" onClick={() => handleSubmit(d.id)}>
                        Lisa sellele
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm mb-2">Või esita uus teade (põhjendus kohustuslik):</p>
                  <Textarea
                    placeholder="Põhjenda, miks esitad uue teate..."
                    value={duplicateReason}
                    onChange={(e) => setDuplicateReason(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        {step > 0 && (
          <Button variant="outline" onClick={prevStep} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Tagasi
          </Button>
        )}
        <div className="flex-1" />
        {step < STEPS.length - 1 ? (
          <Button onClick={nextStep} disabled={!canProceed()} className="gap-1 bg-orange-500 hover:bg-orange-600">
            Edasi
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            onClick={() => handleSubmit()} 
            disabled={!canProceed() || submitting}
            className="gap-1 bg-orange-500 hover:bg-orange-600"
          >
            {submitting ? 'Esitan...' : 'Esita teade'}
          </Button>
        )}
      </div>
    </div>
  );
}
