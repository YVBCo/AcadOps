'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building, Plus, Edit2, Trash2, MapPin, Users, Loader2 } from 'lucide-react';
import { classroomApi } from '@/lib/api';
import { toast } from 'sonner';
import clsx from 'clsx';

export default function ClassroomsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '', building: '', capacity: 60, type: 'LECTURE'
  });

  const { data: classrooms, isLoading } = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => classroomApi.list().then((r: any) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => classroomApi.create(data),
    onSuccess: () => {
      toast.success('Classroom created');
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      handleCloseModal();
    },
    onError: () => toast.error('Failed to create classroom')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => classroomApi.update(id, data),
    onSuccess: () => {
      toast.success('Classroom updated');
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      handleCloseModal();
    },
    onError: () => toast.error('Failed to update classroom')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => classroomApi.remove(id),
    onSuccess: () => {
      toast.success('Classroom deleted');
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
    onError: () => toast.error('Failed to delete classroom')
  });

  const handleOpenModal = (room?: any) => {
    if (room) {
      setEditingId(room.id);
      setFormData({ name: room.name, building: room.building, capacity: room.capacity, type: room.type });
    } else {
      setEditingId(null);
      setFormData({ name: '', building: '', capacity: 60, type: 'LECTURE' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'LECTURE': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LAB': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'SEMINAR': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-24 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 rounded-2xl text-white shadow-xl">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building className="w-8 h-8 text-indigo-400" />
            Classrooms & Labs
          </h1>
          <p className="text-indigo-200 mt-2 text-sm max-w-2xl">
            Manage physical spaces, capacities, and laboratory designations for your department's scheduling.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-white text-indigo-900 hover:bg-indigo-50 shadow-md font-semibold px-6 py-6 rounded-xl text-md transition-all hover:scale-105 active:scale-95">
          <Plus className="w-5 h-5 mr-2" /> Add Space
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200 text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Room Name / ID</th>
                <th className="px-6 py-4">Building</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Capacity</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                    <p className="text-slate-500">Loading spaces...</p>
                  </td>
                </tr>
              ) : classrooms?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Building className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">No spaces found</h3>
                    <p className="text-slate-500 mt-1">Add your first classroom or laboratory to get started.</p>
                  </td>
                </tr>
              ) : (
                classrooms?.map((room: any) => (
                  <tr key={room.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                        {room.type === 'LAB' ? <Building className="w-5 h-5"/> : <Building className="w-5 h-5" />}
                      </div>
                      {room.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md w-fit">
                        <MapPin className="w-3.5 h-3.5" /> {room.building}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx("px-2.5 py-1 rounded-full text-xs font-bold border", getTypeColor(room.type))}>
                        {room.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Users className="w-4 h-4 text-slate-400" /> {room.capacity} seats
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenModal(room)} className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if(confirm('Delete this space?')) deleteMutation.mutate(room.id); }} className="text-slate-500 hover:text-red-600 hover:bg-red-50">
                        {deleteMutation.isPending && deleteMutation.variables === room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-0 animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-4 bg-slate-50 border-b pb-4 rounded-t-xl">
              <h3 className="text-lg font-semibold text-slate-800">{editingId ? 'Edit Space' : 'Add New Space'}</h3>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Room Name/Number</label>
                  <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. CS-101" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Building</label>
                  <Input required value={formData.building} onChange={e => setFormData({...formData, building: e.target.value})} placeholder="e.g. Main Block" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Type</label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="LECTURE">Lecture Hall</option>
                      <option value="LAB">Laboratory</option>
                      <option value="SEMINAR">Seminar Room</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Capacity</label>
                    <Input type="number" required min={1} value={formData.capacity} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editingId ? 'Save Changes' : 'Create Space'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
