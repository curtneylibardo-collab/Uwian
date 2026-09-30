import { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useNav } from '@/lib/nav';
import { GlassPanel, Toast } from '@/components/Glass';
import { BottleCap } from '@/components/BottleCap';
import type { Spot, Session } from '@/lib/types';
import { ArrowLeft, Plus, MapPin, Check, X } from 'lucide-react';

// Fix Leaflet default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makePinIcon(color: string) {
  return L.divIcon({
    className: 'map-pin-wrapper',
    html: `<div class="map-pin"><div class="map-pin-shadow"></div><div class="map-pin-body" style="background: ${color}"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

const pinColors = {
  amber: '#F2A93B',
  grey: '#888888',
  red: '#D8452F',
};

export function TambayanMapScreen({ groupId }: { groupId: string }) {
  const { profile } = useAuth();
  const { back } = useNav();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  const [spots, setSpots] = useState<Spot[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newClosing, setNewClosing] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newLat, setNewLat] = useState(14.6549);
  const [newLng, setNewLng] = useState(121.0316);
  const [toast, setToast] = useState<string | null>(null);

  const loadSpots = useCallback(async () => {
    const { data } = await supabase.from('spots').select('*').eq('group_id', groupId).order('name');
    setSpots((data as Spot[]) ?? []);

    const { data: sess } = await supabase
      .from('sessions')
      .select('*, spot:spots(*)')
      .eq('group_id', groupId)
      .eq('status', 'live')
      .order('session_date', { ascending: false });
    setSessions((sess as Session[]) ?? []);
  }, [groupId]);

  useEffect(() => { loadSpots(); }, [loadSpots]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [14.6549, 121.0316],
      zoom: 15,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (adding) {
        setNewLat(e.latlng.lat);
        setNewLng(e.latlng.lng);
      }
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers when spots or sessions change
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const liveSpotIds = new Set(sessions.map((s) => s.spot_id).filter(Boolean));

    spots.forEach((spot) => {
      let color = pinColors.grey;
      if (liveSpotIds.has(spot.id)) color = pinColors.red;
      else if (spot.verified) color = pinColors.amber;

      const marker = L.marker([spot.lat, spot.lng], { icon: makePinIcon(color) })
        .addTo(map)
        .on('click', () => setSelectedSpot(spot));

      markersRef.current[spot.id] = marker;
    });
  }, [spots, sessions]);

  async function handleAddSpot() {
    if (!profile || !newName.trim()) return;
    const { data, error } = await supabase
      .from('spots')
      .insert({
        group_id: groupId,
        name: newName.trim(),
        lat: newLat,
        lng: newLng,
        price_range: newPrice || null,
        closing_time: newClosing || null,
        notes: newNotes || null,
        verified: false,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      setToast('Hindi nagawa ang spot. Subukan ulit.');
      return;
    }

    setToast('Naitapon ang spot sa mapa.');
    setAdding(false);
    setNewName('');
    setNewPrice('');
    setNewClosing('');
    setNewNotes('');
    loadSpots();
  }

  return (
    <div className="fixed inset-0" style={{ background: 'var(--surface)' }}>
      <div ref={mapRef} className="absolute inset-0" style={{ filter: 'var(--map-filter)' }} />

      {/* Glass top bar */}
      <div className="absolute top-0 left-0 right-0 z-[400] p-4">
        <GlassPanel className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={back} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--glass-tint)' }}>
              <ArrowLeft size={20} style={{ color: 'var(--text)' }} />
            </button>
            <h1 className="font-heading font-bold text-base" style={{ color: 'var(--text)' }}>Tambayan map</h1>
          </div>
          <button
            onClick={() => { setAdding(!adding); if (!adding) setSelectedSpot(null); }}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: adding ? 'var(--red)' : 'var(--amber)', color: 'white' }}
          >
            {adding ? <X size={20} /> : <Plus size={20} />}
          </button>
        </GlassPanel>
      </div>

      {/* Add spot form (glass bottom sheet) */}
      {adding && (
        <div className="absolute bottom-0 left-0 right-0 z-[400] p-4 slide-up">
          <GlassPanel className="p-5 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={18} style={{ color: 'var(--amber)' }} />
              <h2 className="font-heading font-bold text-base" style={{ color: 'var(--text)' }}>Bagong spot</h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tap sa mapa para ilagay ang pin.</p>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--amber)' }}>
              <span className="led led-amber" />
              <span>{newLat.toFixed(4)}, {newLng.toFixed(4)}</span>
            </div>
            <input className="neu-inset w-full px-4 py-3 text-[var(--text)] outline-none" placeholder="Pangalan ng spot" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="neu-inset w-full px-4 py-3 text-[var(--text)] outline-none" placeholder="Presyo (₱₱)" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
              <input className="neu-inset w-full px-4 py-3 text-[var(--text)] outline-none" placeholder="Sarado ng" value={newClosing} onChange={(e) => setNewClosing(e.target.value)} />
            </div>
            <input className="neu-inset w-full px-4 py-3 text-[var(--text)] outline-none" placeholder="Notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            <div className="flex justify-center pt-2">
              <BottleCap label="itapon" size="lg" onClick={handleAddSpot} />
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Spot detail sheet (glass) */}
      {selectedSpot && !adding && (
        <div className="absolute bottom-0 left-0 right-0 z-[400] p-4 slide-up">
          <GlassPanel className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'var(--text)' }}>{selectedSpot.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {selectedSpot.verified ? (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--green-light)' }}><Check size={12} /> Verified</span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Unverified</span>
                  )}
                  {selectedSpot.price_range && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· {selectedSpot.price_range}</span>}
                  {selectedSpot.closing_time && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>· Sarado ng {selectedSpot.closing_time}</span>}
                </div>
              </div>
              <button onClick={() => setSelectedSpot(null)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--glass-tint)' }}>
                <X size={16} style={{ color: 'var(--text)' }} />
              </button>
            </div>
            {selectedSpot.notes && (
              <p className="text-sm mb-3" style={{ color: 'var(--text)' }}>{selectedSpot.notes}</p>
            )}
            {mapInstance.current && (
              <button
                onClick={() => mapInstance.current?.flyTo([selectedSpot.lat, selectedSpot.lng], 17)}
                className="text-xs font-heading font-semibold active:opacity-60"
                style={{ color: 'var(--amber)' }}
              >
                Zoom in dito
              </button>
            )}
          </GlassPanel>
        </div>
      )}

      {/* Pin legend */}
      <div className="absolute top-24 left-4 z-[400]">
        <GlassPanel className="px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
            <span className="map-pin inline-block" style={{ width: 14, height: 14 }}><span className="map-pin-body" style={{ background: pinColors.amber, width: 10, height: 10 }} /></span>
            <span>Verified</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
            <span className="map-pin inline-block" style={{ width: 14, height: 14 }}><span className="map-pin-body" style={{ background: pinColors.red, width: 10, height: 10 }} /></span>
            <span>Live session</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text)' }}>
            <span className="map-pin inline-block" style={{ width: 14, height: 14 }}><span className="map-pin-body" style={{ background: pinColors.grey, width: 10, height: 10 }} /></span>
            <span>Unverified</span>
          </div>
        </GlassPanel>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
