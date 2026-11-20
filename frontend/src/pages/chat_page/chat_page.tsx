import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChatSidebar, ChatWindow, EmptyChatState, CreateGroupDialog } from "./components";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatLogic } from "./hooks/useChatLogic";

export default function ChatPage() {
  const { chatId } = useParams();
  const [params] = useSearchParams();
  const groupId = params.get("group");
  const navigate = useNavigate();
  const [creatingGroup, setCreatingGroup] = useState(false);
  const { user } = useAuthStore();
  const [sidebarWidth, setSidebarWidth] = useState(384);

  const chat = useChatLogic(chatId, groupId, navigate);
  const isOpen = !!(chat.activeChat || chat.activeGroup);
  const showSidebar = !isOpen;

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setSidebarWidth(Math.max(280, Math.min(newWidth, 600)));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
  };

  const handleChatSelect = (id: string) => {
    navigate(id.startsWith("g:") ? `/chat?group=${id.slice(2)}` : `/chat/${id}`);
  };

  const handleBackClick = () => {
    navigate("/chat");
  };

  if (!user) return null; // Handle unauthenticated edge visually smoothly

  return (
    <div
      className="h-full flex overflow-hidden bg-background font-sans"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Sidebar */}
      <div
        className={`${
          showSidebar
            ? "w-full md:w-[var(--sidebar-width)]"
            : "hidden md:flex md:w-[var(--sidebar-width)] flex-col"
        } relative flex-shrink-0 border-r border-border transition-none h-full`}
      >
        <ChatSidebar
          chats={chat.activeChatsList}
          activeChat={chat.activeGroup ? `g:${chat.activeGroup.id}` : chat.activeChat}
          onChatSelect={handleChatSelect}
          onNewGroup={() => setCreatingGroup(true)}
          notice={showSidebar ? chat.notice : null}
          onDismissNotice={chat.clearNotice}
        />
        {/* Resize Handle */}
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-border active:bg-border/80 z-50 hidden md:block transition-colors"
          onMouseDown={handleMouseDown}
        />
      </div>

      {/* Chat Window */}
      <div
        className={`${showSidebar ? "hidden md:flex" : "flex"} relative flex-1 flex-col h-full overflow-hidden`}
      >
        {isOpen ? (
          <>
            {chat.notice && (
              <button
                onClick={chat.clearNotice}
                className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-lg"
              >
                {chat.notice}
              </button>
            )}
            <ChatWindow
              user={chat.activeUser}
              group={chat.activeGroup}
              messages={chat.messages}
              currentUserId={user.id}
              typingText={chat.typingText}
              suggestions={chat.suggestions}
              onSendMessage={chat.handleSendMessage}
              onTyping={chat.handleTyping}
              onUploadImage={chat.uploadImage}
              onBackClick={handleBackClick}
              showBack={!showSidebar}
              onClearChat={chat.handleClearChat}
              onRemoveFriend={chat.handleRemoveFriend}
              onBlock={chat.handleBlock}
              onReport={chat.handleReport}
              onLeaveGroup={chat.leaveGroup}
              friendLocation={chat.friendLocation}
              isSharingLocation={chat.isSharingLocation}
              onToggleLocation={chat.toggleShareLocation}
            />
          </>
        ) : (
          <EmptyChatState />
        )}
      </div>

      {creatingGroup && (
        <CreateGroupDialog friends={chat.friends} onCreate={chat.createGroup} onClose={() => setCreatingGroup(false)} />
      )}
    </div>
  );
}
