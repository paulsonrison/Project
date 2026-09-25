import Button from "./Button";

export default function ButtonDemo() {
  return (
    <div className="flex flex-col">
      <div className="m-1 space-x-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="save">Save</Button>
        <Button variant="cancel">cancel</Button>
      </div>

      <div className="m-1 space-x-2">
        <Button variant="primary" icon={<span>←</span>}>
          Prev
        </Button>
        <Button variant="secondary" icon={<span>→</span>} iconPosition="right">
          Next
        </Button>
        <Button variant="ghost" icon={<span>★</span>}>
          Favorite
        </Button>
        <Button variant="danger" icon={<span>✕</span>} iconPosition="right">
          Delete
        </Button>
        <Button variant="save" icon={<span>✓</span>}>
          Save
        </Button>
        <Button variant="cancel" icon={<span>↩</span>} iconPosition="right">
          Cancel
        </Button>
      </div>

      <div className="m-1 space-x-2">
        <Button variant="primary" icon={<span>→</span>} iconPosition="right">
          Continue
        </Button>
        <Button variant="secondary" icon={<span>←</span>}>
          Back
        </Button>
        <Button variant="ghost" icon={<span>★</span>} iconPosition="right">
          Rate
        </Button>
        <Button variant="danger" icon={<span>✕</span>}>
          Remove
        </Button>
        <Button variant="save" icon={<span>✓</span>} iconPosition="right">
          Submit
        </Button>
        <Button variant="cancel" icon={<span>✕</span>}>
          Close
        </Button>
      </div>
    </div>
  );
}
