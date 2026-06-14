import Image from 'next/image';

export interface ProfileHeaderProps {
  personaName: string;
  avatarUrl: string;
  profileUrl?: string;
  countryCode?: string;
}

export function ProfileHeader({
  personaName,
  avatarUrl,
  profileUrl,
  countryCode,
}: ProfileHeaderProps): JSX.Element {
  return (
    <div className="flex items-center gap-4">
      <Image
        src={avatarUrl}
        alt={personaName}
        width={64}
        height={64}
        sizes="64px"
        className="rounded-full shrink-0"
      />
      <div className="flex flex-col">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-h2 font-semibold text-text-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 hover:text-text-2 transition-colors"
          >
            {personaName}
          </a>
        ) : (
          <span className="text-h2 font-semibold text-text-1">{personaName}</span>
        )}
        {countryCode && <span className="text-caption text-text-3">{countryCode}</span>}
      </div>
    </div>
  );
}
