import Input from "./Input";

export default function TextFieldDemo() {
  return (
    <div className="w-[30%] flex-col gap-2 p-3">
      <Input value={"hello"} />
      <Input label="Default Variant" />
      <Input label="Cell Variant" variant="cell" />
      <Input label="disabled" disabled/>
    </div>
  );
}
