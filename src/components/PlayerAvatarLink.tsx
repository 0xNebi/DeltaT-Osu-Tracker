import { useState } from 'react';
import { FiUser } from 'react-icons/fi';
import { useMatchContext } from '../context/MatchContext';

interface PlayerAvatarLinkProps {
  userId: number;
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  nameClassName?: string;
}

const sizeMap = {
  sm: { wrapper: 'w-8 h-8 text-xs', name: 'text-sm' },
  md: { wrapper: 'w-10 h-10 text-sm', name: 'text-base' },
  lg: { wrapper: 'w-12 h-12 text-base', name: 'text-lg' },
};

const PlayerAvatarLink = ({
  userId,
  username,
  avatarUrl,
  size = 'md',
  className = '',
  nameClassName = '',
}: PlayerAvatarLinkProps) => {
  const [hasError, setHasError] = useState(false);
  const { settings, censorName } = useMatchContext();
  const sizeConfig = sizeMap[size];

  const displayName = censorName(username, userId);
  const privacyMode = settings.privacyMode;

  const initials = displayName
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const showImage = !privacyMode && avatarUrl && !hasError;

  return (
    <a
      href={privacyMode ? undefined : `https://osu.ppy.sh/users/${userId}`}
      target={privacyMode ? undefined : '_blank'}
      rel="noreferrer"
      onClick={privacyMode ? (e) => e.preventDefault() : undefined}
      className={`inline-flex items-center gap-3 text-white hover:text-cyan-200 transition-colors ${privacyMode ? 'cursor-default' : ''} ${className}`.trim()}
    >
      {showImage ? (
        <img
          src={avatarUrl ?? undefined}
          alt={`${displayName} avatar`}
          loading="lazy"
          onError={() => setHasError(true)}
          className={`${sizeConfig.wrapper} rounded-full object-cover border border-white/10`}
        />
      ) : privacyMode ? (
        <span
          className={`${sizeConfig.wrapper} rounded-full bg-zinc-700/60 flex items-center justify-center border border-white/10`}
        >
          <FiUser className="text-zinc-400" size={size === 'sm' ? 12 : size === 'lg' ? 18 : 14} />
        </span>
      ) : (
        <span
          className={`${sizeConfig.wrapper} rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center font-semibold text-white border border-white/10`}
        >
          {initials || '??'}
        </span>
      )}
      <span className={`${sizeConfig.name} font-semibold leading-tight ${nameClassName}`.trim()}>{displayName}</span>
    </a>
  );
};

export default PlayerAvatarLink;
