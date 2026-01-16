import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Camera, MapPin, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('tickets')
      .select('id, ticket_number, location, status, created_at')
      .eq('problem_type_id', selectedProblem.id)
      .ilike('location_key', location.trim().toLowerCase())
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

      toast.success('Teade edukalt esitatud!');
      navigate('/my-tickets');
    } catch (error) {
      console.error('Error submitting ticket:', error);
      toast.error('Teate esitamine ebaõnnestus');
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Uus teade</h1>
      </div>

      {/* Progress */}
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

      {/* Step Content */}
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
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
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

          <Button variant="outline" className="w-full gap-2" disabled>
            <Camera className="h-4 w-4" />
            Lisa pilt (tuleb varsti)
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Teate kokkuvõte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Valdkond:</span> {selectedCategory?.name}</p>
              <p><span className="text-muted-foreground">Probleem:</span> {selectedProblem?.name}</p>
              <p><span className="text-muted-foreground">Asukoht:</span> {location}</p>
              {description && <p><span className="text-muted-foreground">Lisainfo:</span> {description}</p>}
            </CardContent>
          </Card>

          {/* Duplicate Warning */}
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

      {/* Navigation */}
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
