export default function PublicHeader() {
  return (
    <div className="flex flex-row justify-between px-[22%] py-5 bg-primary-foreground font-bold uppercase border-b-2 border-primary">
      <div className="text-[20px] font-[1000]">
        <span className="text-primary">Press</span>
        <span className="text-accent">Track</span>
      </div>
      <div className="flex flex-row gap-8 ">
        <div className="flex flex-row gap-5 text-muted-foreground ">
          <div>Home</div>
          <div>About</div>
          <div>Contact</div>
        </div>
        <div>Sign in</div>
      </div>
    </div>
  );
}
