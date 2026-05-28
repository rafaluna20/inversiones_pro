'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';


interface Comment {
    usuarioId: string;
    usuarioNombre: string;
    icono?: string;
    mensaje: string;
    fecha: number;
    reacciones?: {
        [key: string]: string[]; // emoji -> array of userIds
    };
}

interface CommentsSectionProps {
    comments: Comment[];
    currentUserId?: string;
    creatorId?: string;
    onSubmitComment: (message: string) => Promise<void>;
    onEditComment?: (index: number, newMessage: string) => Promise<void>;
    onDeleteComment?: (index: number) => Promise<void>;
    onToggleReaction?: (index: number, emoji: string) => Promise<void>;
    userAvatar?: string;
    userName?: string;
}

type SortOption = 'recent' | 'oldest' | 'creator';
type CommentState = 'idle' | 'validating' | 'submitting' | 'success' | 'error';

const REACTIONS = [
    { emoji: '👍', label: 'Útil' },
    { emoji: '🎯', label: 'De acuerdo' },
    { emoji: '💡', label: 'Buena idea' },
    { emoji: '❓', label: 'Pregunta' },
];

export default function CommentsSection({
    comments,
    currentUserId,
    creatorId,
    onSubmitComment,
    onEditComment,
    onDeleteComment,
    onToggleReaction,
    userAvatar,
    userName,
}: CommentsSectionProps) {
    const [commentText, setCommentText] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [state, setState] = useState<CommentState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [expandedMenuIndex, setExpandedMenuIndex] = useState<number | null>(null);
    const [showReactionsIndex, setShowReactionsIndex] = useState<number | null>(null);
    const [showAllComments, setShowAllComments] = useState(false);

    const INITIAL_COMMENTS_SHOWN = 3;

    // Validación en tiempo real
    const getValidationStatus = (text: string) => {
        if (text.trim().length === 0) return { valid: false, message: '', color: '' };
        if (text.trim().length < 10) {
            return {
                valid: false,
                message: `Muy corto (${text.trim().length}/10 caracteres mínimos)`,
                color: 'text-red-400',
            };
        }
        if (text.length > 485) {
            return {
                valid: true,
                message: `Acercándose al límite (${text.length}/500)`,
                color: 'text-yellow-400',
            };
        }
        return {
            valid: true,
            message: `Perfecto (${text.length}/500)`,
            color: 'text-green-400',
        };
    };

    const validation = getValidationStatus(commentText);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validation.valid || state === 'submitting') return;

        setState('submitting');
        setErrorMessage('');

        try {
            await onSubmitComment(commentText.trim());
            setState('success');
            setCommentText('');

            setTimeout(() => setState('idle'), 2000);
        } catch (error: any) {
            setState('error');
            setErrorMessage(error.message || 'Error al publicar comentario');
            setTimeout(() => setState('idle'), 3000);
        }
    };

    const handleEdit = async (index: number) => {
        if (!onEditComment || editText.trim().length < 10) return;

        try {
            await onEditComment(index, editText.trim());
            setEditingIndex(null);
            setEditText('');
        } catch (error) {
            console.error('Error editing comment:', error);
        }
    };

    const handleDelete = async (index: number) => {
        if (!onDeleteComment) return;

        if (confirm('¿Eliminar comentario?\nEsta acción no se puede deshacer.')) {
            try {
                await onDeleteComment(index);
                setExpandedMenuIndex(null);
            } catch (error) {
                console.error('Error deleting comment:', error);
            }
        }
    };

    const handleReactionToggle = async (index: number, emoji: string) => {
        if (!onToggleReaction) return;

        try {
            await onToggleReaction(index, emoji);
            setShowReactionsIndex(null);
        } catch (error) {
            console.error('Error toggling reaction:', error);
        }
    };

    // Get reaction count for a specific emoji
    const getReactionCount = (comment: Comment, emoji: string) => {
        return comment.reacciones?.[emoji]?.length || 0;
    };

    // Check if current user reacted with emoji
    const hasUserReacted = (comment: Comment, emoji: string) => {
        return currentUserId ? comment.reacciones?.[emoji]?.includes(currentUserId) : false;
    };

    // Sorting logic
    const sortedComments = [...comments].sort((a, b) => {
        switch (sortBy) {
            case 'recent':
                return b.fecha - a.fecha;
            case 'oldest':
                return a.fecha - b.fecha;
            case 'creator':
                if (a.usuarioId === creatorId && b.usuarioId !== creatorId) return -1;
                if (b.usuarioId === creatorId && a.usuarioId !== creatorId) return 1;
                return b.fecha - a.fecha;
            default:
                return 0;
        }
    });

    // Pagination logic
    const totalComments = sortedComments.length;
    const displayedComments = showAllComments
        ? sortedComments
        : sortedComments.slice(0, INITIAL_COMMENTS_SHOWN);
    const remainingComments = totalComments - INITIAL_COMMENTS_SHOWN;
    const hasMore = remainingComments > 0;

    return (
        <section className="card">
            {/* Header with Sort */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <i className="bx bx-comment-dots text-blue-400"></i>
                    Comentarios ({comments.length})
                </h2>

                {comments.length > 1 && (
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="px-4 py-2 bg-slate-900/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none pr-10"
                        >
                            <option value="recent">Más recientes</option>
                            <option value="oldest">Más antiguos</option>
                            <option value="creator">Del creador primero</option>
                        </select>
                        <i className="bx bx-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                    </div>
                )}
            </div>

            {/* Comment Form - Empresarial */}
            {currentUserId ? (
                <div className="relative p-8 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 border-2 border-white/[0.08] hover:border-white/[0.12] rounded-2xl mb-8 transition-all duration-300">
                    {/* Success Overlay */}
                    {state === 'success' && (
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl flex items-center justify-center z-10 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                                    <i className="bx bx-check text-4xl text-white"></i>
                                </div>
                                <p className="text-green-400 font-semibold">¡Comentario publicado!</p>
                            </div>
                        </div>
                    )}

                    {/* User Preview */}
                    <div className="flex items-start gap-4 mb-6">
                        <img
                            src={userAvatar || '/static/img/imagenPerfil.png'}
                            alt={userName || 'Usuario'}
                            className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/30"
                        />
                        <div className="flex-1">
                            <p className="text-base font-semibold text-white mb-1">
                                {userName || 'Usuario'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                <i className="bx bx-edit-alt"></i>
                                Escribiendo un comentario
                            </p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <textarea
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="💭 Comparte tu opinión sobre este proyecto..."
                                className="w-full min-h-[140px] p-5 bg-slate-900/50 border-2 border-white/10 hover:border-white/20 focus:border-blue-500/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 resize-none transition-all duration-300 leading-relaxed"
                                maxLength={500}
                                disabled={state === 'submitting'}
                            />

                            {/* Character Counter with Validation */}
                            <div className="absolute bottom-4 right-4 flex items-center gap-2">
                                {commentText.length > 0 && (
                                    <span className={`text-xs font-medium ${validation.color}`}>
                                        {validation.message}
                                    </span>
                                )}
                                <span className="text-xs text-gray-500 font-mono">
                                    {commentText.length}/500
                                </span>
                            </div>
                        </div>

                        {/* Error Message */}
                        {state === 'error' && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                <i className="bx bx-error-circle text-lg"></i>
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <i className="bx bx-info-circle"></i>
                                <span>Sé respetuoso y constructivo</span>
                            </div>

                            <button
                                type="submit"
                                disabled={!validation.valid || state === 'submitting'}
                                className="group relative px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 disabled:shadow-none overflow-hidden"
                            >
                                {state === 'submitting' ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Publicando...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="bx bx-send text-lg"></i>
                                        <span>Publicar</span>
                                    </>
                                )}

                                {/* Shine effect */}
                                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="p-10 bg-slate-900/30 border-2 border-white/10 rounded-2xl text-center mb-8">
                    <i className="bx bx-lock-alt text-5xl text-gray-500 mb-4"></i>
                    <p className="text-gray-400 text-lg mb-2">Inicia sesión para comentar</p>
                    <p className="text-sm text-gray-500 mb-6">Únete a la conversación y comparte tu opinión</p>
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40"
                    >
                        <i className="bx bx-user"></i>
                        Iniciar Sesión
                    </Link>
                </div>
            )}

            {/* Comments List */}
            <div className="space-y-4">
                {sortedComments.length === 0 ? (
                    <div className="text-center py-20">
                        <i className="bx bx-message-square-dots text-7xl text-gray-600 mb-4"></i>
                        <p className="text-gray-500 text-xl font-medium mb-2">No hay comentarios aún</p>
                        <p className="text-sm text-gray-600">¡Sé el primero en compartir tu opinión!</p>
                    </div>
                ) : (
                    <>
                        {displayedComments.map((comment, index) => {
                            const isOwn = comment.usuarioId === currentUserId;
                            const isCreator = comment.usuarioId === creatorId;
                            const isEditing = editingIndex === index;

                            return (
                                <article
                                    key={index}
                                    className="group relative p-6 bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-white/5 hover:border-white/10 rounded-2xl transition-all hover:shadow-lg hover:shadow-blue-500/5"
                                    onMouseLeave={() => setShowReactionsIndex(null)}
                                >
                                    <div className="flex gap-4">
                                        {/* Avatar with Badge */}
                                        <div className="relative flex-shrink-0">
                                            <img
                                                src={comment.icono || '/static/img/imagenPerfil.png'}
                                                alt={comment.usuarioNombre}
                                                className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/20 group-hover:ring-blue-500/40 transition"
                                            />
                                            {isCreator && (
                                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center ring-2 ring-slate-900">
                                                    <i className="bx bx-crown text-white text-xs"></i>
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Header */}
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="font-semibold text-white text-base">
                                                    {comment.usuarioNombre}
                                                </span>

                                                {isCreator && (
                                                    <span className="px-2.5 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs rounded-full font-medium">
                                                        Creador
                                                    </span>
                                                )}

                                                <time className="text-xs text-gray-500 ml-auto flex items-center gap-1">
                                                    <i className="bx bx-time-five"></i>
                                                    {formatDistanceToNow(new Date(comment.fecha), { locale: es })}
                                                </time>

                                                {/* Actions Menu */}
                                                {isOwn && !isEditing && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setExpandedMenuIndex(expandedMenuIndex === index ? null : index)}
                                                            className="p-1.5 hover:bg-white/10 rounded-lg transition text-gray-400 hover:text-white"
                                                        >
                                                            <i className="bx bx-dots-horizontal-rounded text-xl"></i>
                                                        </button>

                                                        {expandedMenuIndex === index && (
                                                            <div
                                                                className="absolute right-0 top-full mt-2 w-40 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-10"
                                                            >
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingIndex(index);
                                                                            setEditText(comment.mensaje);
                                                                            setExpandedMenuIndex(null);
                                                                        }}
                                                                        className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition flex items-center gap-2"
                                                                    >
                                                                        <i className="bx bx-edit-alt"></i>
                                                                        Editar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(index)}
                                                                        className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition flex items-center gap-2"
                                                                    >
                                                                        <i className="bx bx-trash"></i>
                                                                        Eliminar
                                                                    </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Message */}
                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <textarea
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        className="w-full p-3 bg-slate-900/50 border border-blue-500/30 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                                                        rows={3}
                                                        maxLength={500}
                                                    />
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingIndex(null);
                                                                setEditText('');
                                                            }}
                                                            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(index)}
                                                            disabled={editText.trim().length < 10}
                                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition disabled:opacity-50"
                                                        >
                                                            Guardar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-gray-300 leading-relaxed break-words text-[15px] mb-3">
                                                        {comment.mensaje}
                                                    </p>

                                                    {/* Reactions Bar */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {/* Existing reactions */}
                                                        {comment.reacciones && Object.entries(comment.reacciones).map(([emoji, users]) => {
                                                            if (users.length === 0) return null;
                                                            const userReacted = currentUserId && users.includes(currentUserId);

                                                            return (
                                                                <button
                                                                    key={emoji}
                                                                    onClick={() => handleReactionToggle(index, emoji)}
                                                                    className={`px-2.5 py-1 rounded-lg text-sm flex items-center gap-1 transition ${userReacted
                                                                        ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                                                                        : 'bg-slate-800/50 border border-white/10 text-gray-400 hover:bg-slate-800'
                                                                        }`}
                                                                    title={`${users.length} ${users.length === 1 ? 'persona' : 'personas'}`}
                                                                >
                                                                    <span>{emoji}</span>
                                                                    <span className="text-xs font-medium">{users.length}</span>
                                                                </button>
                                                            );
                                                        })}

                                                        {/* Add reaction button */}
                                                        {currentUserId && !isEditing && (
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setShowReactionsIndex(showReactionsIndex === index ? null : index)}
                                                                    className="px-2.5 py-1 bg-slate-800/50 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition text-sm"
                                                                    title="Añadir reacción"
                                                                >
                                                                    <i className="bx bx-smile"></i>
                                                                </button>

                                                                {showReactionsIndex === index && (
                                                                    <div
                                                                        className="absolute left-0 bottom-full mb-2 p-2 bg-slate-800 border border-white/10 rounded-xl shadow-xl flex gap-1 z-10"
                                                                    >
                                                                            {REACTIONS.map(({ emoji, label }) => (
                                                                                <button
                                                                                    key={emoji}
                                                                                    onClick={() => handleReactionToggle(index, emoji)}
                                                                                    className="p-2 hover:bg-white/10 rounded-lg transition text-xl"
                                                                                    title={label}
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}

                        {/* Show More / Show Less Button */}
                        {hasMore && !showAllComments && (
                            <button
                                onClick={() => setShowAllComments(true)}
                                className="w-full mt-6 p-4 bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20 border-2 border-blue-500/20 hover:border-blue-500/40 rounded-xl text-blue-400 font-semibold transition-all flex items-center justify-center gap-2 group"
                            >
                                <i className="bx bx-chevron-down text-xl group-hover:animate-bounce"></i>
                                <span>Ver más comentarios ({remainingComments} restantes)</span>
                            </button>
                        )}

                        {showAllComments && hasMore && (
                            <button
                                onClick={() => setShowAllComments(false)}
                                className="w-full mt-6 p-4 bg-gradient-to-r from-slate-800/50 to-slate-700/50 hover:from-slate-800/70 hover:to-slate-700/70 border-2 border-white/10 hover:border-white/20 rounded-xl text-gray-400 hover:text-white font-semibold transition-all flex items-center justify-center gap-2 group"
                            >
                                <i className="bx bx-chevron-up text-xl group-hover:animate-bounce"></i>
                                <span>Ver menos</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
