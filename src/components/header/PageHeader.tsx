export default function PageHeader({ title }: { title: string }) {
  const currentDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="bg-primary-foreground flex justify-between py-3 px-7 border-b-2 border-primary text-muted-foreground">
      {" "}
      <h2 className="uppercase  font-bold">{title}</h2>
      <h2>{currentDate}</h2>
    </div>
  );
}
