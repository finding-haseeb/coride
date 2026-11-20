export default function EmptyChatState() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-background">
      <div className="text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary blur-3xl opacity-5 rounded-full"></div>
          <svg
            className="w-32 h-32 mx-auto text-foreground/20 relative"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="font-headline text-foreground">
            Welcome to CoRide Chat
          </h2>
          <p className="font-body-sm text-foreground/70 max-w-sm mx-auto">
            Select a chat from the sidebar to start messaging your friends and colleagues
          </p>
        </div>
      </div>
    </div>
  );
}
